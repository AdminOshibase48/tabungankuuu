// Database menggunakan localStorage
class CelenganDB {
    constructor() {
        this.usersKey = 'celengan_users';
        this.currentUserKey = 'celengan_current_user';
    }

    // User management
    getUsers() {
        return JSON.parse(localStorage.getItem(this.usersKey)) || [];
    }

    saveUsers(users) {
        localStorage.setItem(this.usersKey, JSON.stringify(users));
    }

    setCurrentUser(username) {
        localStorage.setItem(this.currentUserKey, username);
    }

    getCurrentUser() {
        return localStorage.getItem(this.currentUserKey);
    }

    logout() {
        localStorage.removeItem(this.currentUserKey);
    }

    // Data management untuk user
    getUserData(key) {
        const user = this.getCurrentUser();
        return JSON.parse(localStorage.getItem(`celengan_${user}_${key}`)) || [];
    }

    saveUserData(key, data) {
        const user = this.getCurrentUser();
        localStorage.setItem(`celengan_${user}_${key}`, JSON.stringify(data));
    }

    // Targets
    getTargets() {
        return this.getUserData('targets');
    }

    saveTarget(target) {
        const targets = this.getTargets();
        targets.push({
            id: Date.now(),
            namaBarang: target.namaBarang,
            hargaBarang: parseInt(target.hargaBarang),
            targetHarian: parseInt(target.targetHarian),
            terkumpul: 0,
            createdAt: new Date().toISOString()
        });
        this.saveUserData('targets', targets);
    }

    deleteTarget(targetId) {
        const targets = this.getTargets();
        const updatedTargets = targets.filter(target => target.id !== targetId);
        this.saveUserData('targets', updatedTargets);
        return updatedTargets;
    }

    // Transactions
    getTransactions() {
        return this.getUserData('transactions');
    }

    saveTransaction(transaction) {
        const transactions = this.getTransactions();
        transactions.push({
            id: Date.now(),
            type: transaction.type,
            amount: parseInt(transaction.amount),
            description: transaction.description || 'Tanpa Keterangan',
            date: new Date().toISOString()
        });
        this.saveUserData('transactions', transactions);
        
        // Update saldo di target jika pemasukan
        if (transaction.type === 'pemasukan') {
            this.updateTargetSaldo(parseInt(transaction.amount));
        }
    }

    updateTargetSaldo(amount) {
        const targets = this.getTargets();
        if (targets.length === 0) return;

        const amountPerTarget = Math.floor(amount / targets.length);
        let remainingAmount = amount;

        // Distribusikan ke semua target
        const updatedTargets = targets.map(target => {
            if (target.terkumpul < target.hargaBarang) {
                const toAdd = Math.min(amountPerTarget, target.hargaBarang - target.terkumpul);
                target.terkumpul += toAdd;
                remainingAmount -= toAdd;
            }
            return target;
        });

        // Jika masih ada sisa, distribusikan lagi
        if (remainingAmount > 0) {
            for (let target of updatedTargets) {
                if (target.terkumpul < target.hargaBarang && remainingAmount > 0) {
                    const toAdd = Math.min(remainingAmount, target.hargaBarang - target.terkumpul);
                    target.terkumpul += toAdd;
                    remainingAmount -= toAdd;
                }
            }
        }

        this.saveUserData('targets', updatedTargets);
    }
}

const db = new CelenganDB();
let currentModalCallback = null;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', function() {
    showLoading();
    setTimeout(() => {
        checkAuth();
        initializeForms();
        hideLoading();
    }, 1500);
});

function showLoading() {
    document.getElementById('loadingScreen').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function checkAuth() {
    const currentUser = db.getCurrentUser();
    if (currentUser) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    hideAllPages();
    document.getElementById('loginPage').classList.remove('hidden');
}

function showRegister() {
    hideAllPages();
    document.getElementById('registerPage').classList.remove('hidden');
}

function showDashboard() {
    hideAllPages();
    document.getElementById('dashboardPage').classList.remove('hidden');
    updateWelcomeMessage();
    loadDashboardData();
}

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
}

function updateWelcomeMessage() {
    const currentUser = db.getCurrentUser();
    document.getElementById('welcomeMessage').textContent = `Hai, ${currentUser}!`;
}

function initializeForms() {
    // Form Login
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const users = db.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            db.setCurrentUser(username);
            showDashboard();
        } else {
            showError('Username atau password salah!');
        }
    });

    // Form Register
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirmPassword) {
            showError('Password tidak cocok!');
            return;
        }
        
        if (password.length < 3) {
            showError('Password harus minimal 3 karakter!');
            return;
        }
        
        const users = db.getUsers();
        if (users.find(u => u.username === username)) {
            showError('Username sudah digunakan!');
            return;
        }
        
        users.push({ username, password });
        db.saveUsers(users);
        showSuccess('Registrasi berhasil! Silakan login.');
        showLogin();
    });

    // Form Target
    document.getElementById('targetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const target = {
            namaBarang: document.getElementById('namaBarang').value,
            hargaBarang: document.getElementById('hargaBarang').value,
            targetHarian: document.getElementById('targetHarian').value
        };
        
        db.saveTarget(target);
        this.reset();
        loadDashboardData();
        showSuccess('Target berhasil ditambahkan!');
    });

    // Form Transaksi
    document.getElementById('transactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const transaction = {
            type: document.getElementById('transactionType').value,
            amount: document.getElementById('amount').value,
            description: document.getElementById('description').value
        };
        
        if (!transaction.type) {
            showError('Pilih jenis transaksi!');
            return;
        }
        
        db.saveTransaction(transaction);
        this.reset();
        loadDashboardData();
        showSuccess('Transaksi berhasil dicatat!');
    });
}

function loadDashboardData() {
    loadTargets();
    loadTransactions();
    loadSummary();
    loadChart();
}

function loadTargets() {
    const targets = db.getTargets();
    const targetList = document.getElementById('targetList');
    
    if (targets.length === 0) {
        targetList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Belum ada target menabung</p>';
        return;
    }
    
    targetList.innerHTML = targets.map(target => {
        const progress = (target.terkumpul / target.hargaBarang) * 100;
        const sisaHari = Math.ceil((target.hargaBarang - target.terkumpul) / target.targetHarian);
        
        return `
            <div class="target-item">
                <div class="target-header">
                    <div class="target-name">${target.namaBarang}</div>
                    <div class="target-actions">
                        <button class="btn-delete" onclick="confirmDeleteTarget(${target.id}, '${target.namaBarang}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="target-details">
                    <div>Target: Rp ${target.hargaBarang.toLocaleString()}</div>
                    <div>Terkumpul: Rp ${target.terkumpul.toLocaleString()}</div>
                    <div>Harian: Rp ${target.targetHarian.toLocaleString()}</div>
                    <div>Progress: ${Math.round(progress)}%</div>
                    <div>Sisa: Rp ${(target.hargaBarang - target.terkumpul).toLocaleString()}</div>
                    <div>Perkiraan: ${sisaHari} hari</div>
                </div>
            </div>
        `;
    }).join('');
}

function loadTransactions() {
    const transactions = db.getTransactions();
    const transactionHistory = document.getElementById('transactionHistory');
    
    if (transactions.length === 0) {
        transactionHistory.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Belum ada transaksi</p>';
        return;
    }
    
    transactionHistory.innerHTML = transactions.slice(-10).reverse().map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-desc">${transaction.description}</div>
                <div class="transaction-date">${new Date(transaction.date).toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'pemasukan' ? '+' : '-'} Rp ${transaction.amount.toLocaleString()}
            </div>
        </div>
    `).join('');
}

function loadSummary() {
    const transactions = db.getTransactions();
    
    const totalPemasukan = transactions
        .filter(t => t.type === 'pemasukan')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const totalPengeluaran = transactions
        .filter(t => t.type === 'pengeluaran')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const saldo = totalPemasukan - totalPengeluaran;
    
    document.getElementById('totalPemasukan').textContent = `Rp ${totalPemasukan.toLocaleString()}`;
    document.getElementById('totalPengeluaran').textContent = `Rp ${totalPengeluaran.toLocaleString()}`;
    document.getElementById('saldo').textContent = `Rp ${saldo.toLocaleString()}`;
}

function loadChart() {
    const transactions = db.getTransactions();
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    // Hapus chart sebelumnya jika ada
    if (window.financeChart) {
        window.financeChart.destroy();
    }
    
    // Group transactions by month
    const monthlyData = transactions.reduce((acc, transaction) => {
        const month = new Date(transaction.date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        if (!acc[month]) {
            acc[month] = { pemasukan: 0, pengeluaran: 0 };
        }
        acc[month][transaction.type] += transaction.amount;
        return acc;
    }, {});
    
    const months = Object.keys(monthlyData).slice(-6); // Ambil 6 bulan terakhir
    const pemasukanData = months.map(month => monthlyData[month].pemasukan);
    const pengeluaranData = months.map(month => monthlyData[month].pengeluaran);
    
    window.financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: pemasukanData,
                    backgroundColor: '#28a745',
                    borderRadius: 8
                },
                {
                    label: 'Pengeluaran',
                    data: pengeluaranData,
                    backgroundColor: '#dc3545',
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Grafik Keuangan 6 Bulan Terakhir'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Fitur Hapus Target
function confirmDeleteTarget(targetId, targetName) {
    showModal(
        `Hapus Target "${targetName}"?`,
        `Apakah Anda yakin ingin menghapus target menabung untuk "${targetName}"? Tindakan ini tidak dapat dibatalkan.`,
        () => deleteTarget(targetId)
    );
}

function deleteTarget(targetId) {
    db.deleteTarget(targetId);
    loadDashboardData();
    showSuccess('Target berhasil dihapus!');
    closeModal();
}

// Modal System
function showModal(title, message, confirmCallback) {
    document.getElementById('modalMessage').textContent = message;
    document.querySelector('.modal-header h3').textContent = title;
    currentModalCallback = confirmCallback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    currentModalCallback = null;
}

document.getElementById('confirmButton').addEventListener('click', function() {
    if (currentModalCallback) {
        currentModalCallback();
    }
});

// Notification System
function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type) {
    // Buat element notifikasi
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Style notifikasi
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1001;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Hapus notifikasi setelah 3 detik
    setTimeout(() => {
        notification.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function logout() {
    showModal(
        'Konfirmasi Logout',
        'Apakah Anda yakin ingin logout?',
        () => {
            db.logout();
            showLogin();
            closeModal();
            showSuccess('Logout berhasil!');
        }
    );
}

// Close modal ketika klik di luar
document.getElementById('confirmModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Close modal dengan ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !document.getElementById('confirmModal').classList.contains('hidden')) {
        closeModal();
    }
});
