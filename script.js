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
        const data = localStorage.getItem(`celengan_${user}_${key}`);
        return data ? JSON.parse(data) : [];
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
let financeChart = null;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', function() {
    showLoading();
    setTimeout(() => {
        checkAuth();
        initializeForms();
        hideLoading();
    }, 1000);
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
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Username dan password harus diisi!');
            return;
        }
        
        const users = db.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            db.setCurrentUser(username);
            showDashboard();
            showSuccess('Login berhasil!');
        } else {
            showError('Username atau password salah!');
        }
    });

    // Form Register
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        if (!username || !password || !confirmPassword) {
            showError('Semua field harus diisi!');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Password tidak cocok!');
            return;
        }
        
        if (password.length < 3) {
            showError('Password harus minimal 3 karakter!');
            return;
        }
        
        if (username.length < 3) {
            showError('Username harus minimal 3 karakter!');
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
        const namaBarang = document.getElementById('namaBarang').value.trim();
        const hargaBarang = document.getElementById('hargaBarang').value;
        const targetHarian = document.getElementById('targetHarian').value;
        
        if (!namaBarang || !hargaBarang || !targetHarian) {
            showError('Semua field harus diisi!');
            return;
        }
        
        if (hargaBarang <= 0 || targetHarian <= 0) {
            showError('Harga dan target harian harus lebih dari 0!');
            return;
        }
        
        const target = {
            namaBarang: namaBarang,
            hargaBarang: hargaBarang,
            targetHarian: targetHarian
        };
        
        db.saveTarget(target);
        this.reset();
        loadDashboardData();
        showSuccess('Target berhasil ditambahkan!');
    });

    // Form Transaksi
    document.getElementById('transactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const type = document.getElementById('transactionType').value;
        const amount = document.getElementById('amount').value;
        const description = document.getElementById('description').value.trim() || 'Tanpa Keterangan';
        
        if (!type) {
            showError('Pilih jenis transaksi!');
            return;
        }
        
        if (!amount || amount <= 0) {
            showError('Jumlah transaksi harus lebih dari 0!');
            return;
        }
        
        const transaction = {
            type: type,
            amount: amount,
            description: description
        };
        
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
        targetList.innerHTML = '<div class="empty-state"><i class="fas fa-bullseye"></i><p>Belum ada target menabung</p></div>';
        return;
    }
    
    targetList.innerHTML = targets.map(target => {
        const progress = Math.min((target.terkumpul / target.hargaBarang) * 100, 100);
        const sisaHari = target.targetHarian > 0 ? Math.ceil((target.hargaBarang - target.terkumpul) / target.targetHarian) : 0;
        const sisaDana = target.hargaBarang - target.terkumpul;
        
        return `
            <div class="target-item">
                <div class="target-header">
                    <div class="target-name">${target.namaBarang}</div>
                    <div class="target-actions">
                        <button class="btn-delete" onclick="confirmDeleteTarget(${target.id}, '${target.namaBarang.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="target-details">
                    <div><i class="fas fa-bullseye"></i> Target: Rp ${target.hargaBarang.toLocaleString()}</div>
                    <div><i class="fas fa-piggy-bank"></i> Terkumpul: Rp ${target.terkumpul.toLocaleString()}</div>
                    <div><i class="fas fa-calendar-day"></i> Harian: Rp ${target.targetHarian.toLocaleString()}</div>
                    <div><i class="fas fa-chart-line"></i> Progress: ${Math.round(progress)}%</div>
                    <div><i class="fas fa-wallet"></i> Sisa: Rp ${sisaDana.toLocaleString()}</div>
                    <div><i class="fas fa-clock"></i> Perkiraan: ${sisaHari} hari</div>
                </div>
            </div>
        `;
    }).join('');
}

function loadTransactions() {
    const transactions = db.getTransactions();
    const transactionHistory = document.getElementById('transactionHistory');
    
    if (transactions.length === 0) {
        transactionHistory.innerHTML = '<div class="empty-state"><i class="fas fa-exchange-alt"></i><p>Belum ada transaksi</p></div>';
        return;
    }
    
    transactionHistory.innerHTML = transactions.slice(-10).reverse().map(transaction => {
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('id-ID', { 
            day: 'numeric',
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-desc">${transaction.description}</div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'pemasukan' ? '+' : '-'} Rp ${transaction.amount.toLocaleString()}
                </div>
            </div>
        `;
    }).join('');
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
    
    // Update color based on balance
    const saldoElement = document.getElementById('saldo');
    if (saldo < 0) {
        saldoElement.style.color = '#dc3545';
    } else {
        saldoElement.style.color = '#28a745';
    }
}

function loadChart() {
    const transactions = db.getTransactions();
    const canvas = document.getElementById('financeChart');
    
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart safely
    if (financeChart instanceof Chart) {
        financeChart.destroy();
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Jika tidak ada transaksi
    if (transactions.length === 0) {
        ctx.font = '16px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Belum ada data transaksi', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Process data untuk chart - group by month
    const monthlyData = {};
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('id-ID', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                label: monthLabel,
                pemasukan: 0,
                pengeluaran: 0
            };
        }
        
        monthlyData[monthKey][transaction.type] += transaction.amount;
    });
    
    // Urutkan berdasarkan bulan (terlama ke terbaru)
    const sortedMonths = Object.keys(monthlyData)
        .sort()
        .slice(-6); // Ambil 6 bulan terakhir
    
    const labels = sortedMonths.map(month => monthlyData[month].label);
    const pemasukanData = sortedMonths.map(month => monthlyData[month].pemasukan);
    const pengeluaranData = sortedMonths.map(month => monthlyData[month].pengeluaran);
    
    // Buat chart baru
    financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: pemasukanData,
                    backgroundColor: 'rgba(40, 167, 69, 0.8)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                },
                {
                    label: 'Pengeluaran',
                    data: pengeluaranData,
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 13
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: Rp ${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) {
                                return 'Rp ' + (value / 1000000).toFixed(1) + 'Jt';
                            } else if (value >= 1000) {
                                return 'Rp ' + (value / 1000).toFixed(0) + 'Rb';
                            }
                            return 'Rp ' + value;
                        },
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Fitur Hapus Target
function confirmDeleteTarget(targetId, targetName) {
    showModal(
        `Hapus Target`,
        `Yakin ingin menghapus target "<strong>${targetName}</strong>"? Data yang dihapus tidak dapat dikembalikan.`,
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
    document.getElementById('modalMessage').innerHTML = message;
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
    // Hapus notifikasi sebelumnya
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Buat element notifikasi
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
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
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
        <span>${message}</span>
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
        'Apakah Anda yakin ingin logout dari akun ini?',
        () => {
            db.logout();
            showLogin();
            closeModal();
            showSuccess('Logout berhasil!');
        }
    );
}

// Event Listeners untuk modal
document.getElementById('confirmModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !document.getElementById('confirmModal').classList.contains('hidden')) {
        closeModal();
    }
});

// Prevent form submission on enter key in input fields
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });
});

// Initialize chart on window resize untuk responsive
window.addEventListener('resize', function() {
    if (financeChart instanceof Chart) {
        financeChart.resize();
    }
});
