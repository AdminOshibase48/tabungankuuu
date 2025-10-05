// Database menggunakan localStorage
class CelenganDB {
    constructor() {
        this.usersKey = 'celengan_users';
        this.currentUserKey = 'celengan_current_user';
    }

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

    getUserData(key) {
        const user = this.getCurrentUser();
        const data = localStorage.getItem(`celengan_${user}_${key}`);
        return data ? JSON.parse(data) : [];
    }

    saveUserData(key, data) {
        const user = this.getCurrentUser();
        localStorage.setItem(`celengan_${user}_${key}`, JSON.stringify(data));
    }

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

    getTransactions() {
        return this.getUserData('transactions');
    }

    saveTransaction(transaction) {
        const transactions = this.getTransactions();
        transactions.push({
            id: Date.now(),
            type: 'pemasukan', // Hanya pemasukan sekarang
            amount: parseInt(transaction.amount),
            description: transaction.description || 'Pemasukan Tabungan',
            date: new Date().toISOString(),
            targetId: transaction.targetId
        });
        this.saveUserData('transactions', transactions);
        
        // Update saldo target
        if (transaction.targetId) {
            this.updateTargetSaldo(transaction.targetId, parseInt(transaction.amount));
        }
    }

    updateTargetSaldo(targetId, amount) {
        const targets = this.getTargets();
        const updatedTargets = targets.map(target => {
            if (target.id === targetId) {
                target.terkumpul = Math.min(target.terkumpul + amount, target.hargaBarang);
            }
            return target;
        });
        this.saveUserData('targets', updatedTargets);
    }

    getTargetById(targetId) {
        const targets = this.getTargets();
        return targets.find(target => target.id === targetId);
    }
}

const db = new CelenganDB();
let currentModalCallback = null;
let financeChart = null;
let selectedTargetId = null;

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
            showSuccess('Login berhasil! Selamat menabung! 🎉');
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
        showSuccess(`Target "${namaBarang}" berhasil ditambahkan! 💫`);
    });

    // Form Pemasukan Spesifik untuk Target
    document.getElementById('targetIncomeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const amount = document.getElementById('targetIncomeAmount').value;
        const description = document.getElementById('targetIncomeDescription').value.trim() || 'Pemasukan Tabungan';
        
        if (!amount || amount <= 0) {
            showError('Jumlah pemasukan harus lebih dari 0!');
            return;
        }
        
        if (!selectedTargetId) {
            showError('Tidak ada target yang dipilih!');
            return;
        }
        
        const transaction = {
            amount: amount,
            description: description,
            targetId: selectedTargetId
        };
        
        db.saveTransaction(transaction);
        document.getElementById('targetIncomeForm').reset();
        loadDashboardData();
        showSuccess(`Pemasukan berhasil ditambahkan! 💰`);
        closeTargetDetailModal();
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
        targetList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bullseye"></i>
                <p>Belum ada target menabung</p>
                <small>Klik "Tambah Target" untuk memulai!</small>
            </div>
        `;
        return;
    }
    
    targetList.innerHTML = targets.map(target => {
        const progress = Math.min((target.terkumpul / target.hargaBarang) * 100, 100);
        const sisaHari = target.targetHarian > 0 ? Math.ceil((target.hargaBarang - target.terkumpul) / target.targetHarian) : 0;
        const sisaDana = target.hargaBarang - target.terkumpul;
        const progressColor = progress >= 100 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444';
        
        return `
            <div class="target-item" onclick="showTargetDetail(${target.id})">
                <div class="target-header">
                    <div class="target-name">${target.namaBarang}</div>
                    <div class="target-actions">
                        <button class="btn-delete" onclick="event.stopPropagation(); confirmDeleteTarget(${target.id}, '${target.namaBarang.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
                <div class="progress-container">
                    <div class="progress-info">
                        <span>Progress: ${Math.round(progress)}%</span>
                        <span>Rp ${target.terkumpul.toLocaleString()} / Rp ${target.hargaBarang.toLocaleString()}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%; background: ${progressColor};"></div>
                    </div>
                </div>
                <div class="target-details">
                    <div class="target-detail-item">
                        <i class="fas fa-calendar-day"></i>
                        <span>Harian: Rp ${target.targetHarian.toLocaleString()}</span>
                    </div>
                    <div class="target-detail-item">
                        <i class="fas fa-wallet"></i>
                        <span>Sisa: Rp ${sisaDana.toLocaleString()}</span>
                    </div>
                    <div class="target-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>Perkiraan: ${sisaHari} hari</span>
                    </div>
                    <div class="target-detail-item">
                        <i class="fas ${progress >= 100 ? 'fa-check-circle' : 'fa-spinner'}"></i>
                        <span>Status: ${progress >= 100 ? 'Tercapai!' : 'Dalam Progress'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Fungsi untuk menampilkan detail target
function showTargetDetail(targetId) {
    const target = db.getTargetById(targetId);
    if (!target) return;
    
    selectedTargetId = targetId;
    
    const progress = Math.min((target.terkumpul / target.hargaBarang) * 100, 100);
    const sisaDana = target.hargaBarang - target.terkumpul;
    const sisaHari = target.targetHarian > 0 ? Math.ceil(sisaDana / target.targetHarian) : 0;
    
    // Update modal content
    document.getElementById('targetDetailTitle').textContent = `Detail: ${target.namaBarang}`;
    document.getElementById('detailNamaBarang').textContent = target.namaBarang;
    document.getElementById('detailHargaBarang').textContent = `Rp ${target.hargaBarang.toLocaleString()}`;
    document.getElementById('detailTerkumpul').textContent = `Rp ${target.terkumpul.toLocaleString()}`;
    document.getElementById('detailSisa').textContent = `Rp ${sisaDana.toLocaleString()}`;
    document.getElementById('detailTargetHarian').textContent = `Rp ${target.targetHarian.toLocaleString()}`;
    document.getElementById('detailPerkiraan').textContent = `${sisaHari} hari lagi`;
    document.getElementById('detailProgressText').textContent = `${Math.round(progress)}%`;
    document.getElementById('detailProgressFill').style.width = `${progress}%`;
    
    // Reset form
    document.getElementById('targetIncomeForm').reset();
    
    // Show modal
    document.getElementById('targetDetailModal').classList.remove('hidden');
}

function closeTargetDetailModal() {
    document.getElementById('targetDetailModal').classList.add('hidden');
    selectedTargetId = null;
}

function loadTransactions() {
    const transactions = db.getTransactions();
    const transactionHistory = document.getElementById('transactionHistory');
    
    if (transactions.length === 0) {
        transactionHistory.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>Belum ada pemasukan</p>
                <small>Klik target untuk menambah pemasukan!</small>
            </div>
        `;
        return;
    }
    
    transactionHistory.innerHTML = transactions.slice(-8).reverse().map(transaction => {
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
                <div class="transaction-amount">
                    + Rp ${transaction.amount.toLocaleString()}
                </div>
            </div>
        `;
    }).join('');
}

function loadSummary() {
    const targets = db.getTargets();
    const transactions = db.getTransactions();
    
    const totalPemasukan = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTarget = targets.reduce((sum, t) => sum + t.hargaBarang, 0);
    const totalTerkumpul = targets.reduce((sum, t) => sum + t.terkumpul, 0);
    const progressTotal = totalTarget > 0 ? Math.round((totalTerkumpul / totalTarget) * 100) : 0;
    
    document.getElementById('totalPemasukan').textContent = `Rp ${totalPemasukan.toLocaleString()}`;
    document.getElementById('totalTarget').textContent = `Rp ${totalTarget.toLocaleString()}`;
    document.getElementById('progressTotal').textContent = `${progressTotal}%`;
}

function loadChart() {
    const targets = db.getTargets();
    const canvas = document.getElementById('financeChart');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart safely
    if (financeChart instanceof Chart) {
        financeChart.destroy();
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Jika tidak ada target
    if (targets.length === 0) {
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Belum ada data target', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Data untuk chart
    const labels = targets.map(t => t.namaBarang);
    const data = targets.map(t => t.terkumpul);
    const backgrounds = targets.map((_, i) => {
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
        return colors[i % colors.length];
    });
    
    // Buat pie chart
    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgrounds,
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const target = targets[context.dataIndex];
                            const percentage = target.hargaBarang > 0 ? Math.round((value / target.hargaBarang) * 100) : 0;
                            return `${label}: Rp ${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
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
    showSuccess('Target berhasil dihapus! 🗑️');
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
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function logout() {
    showModal(
        'Konfirmasi Logout',
        'Apakah Anda yakin ingin logout dari akun ini?',
        () => {
            db.logout();
            showLogin();
            closeModal();
            showSuccess('Logout berhasil! Sampai jumpa! 👋');
        }
    );
}

// Event Listeners untuk modal
document.getElementById('targetDetailModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeTargetDetailModal();
    }
});

document.getElementById('confirmModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (!document.getElementById('targetDetailModal').classList.contains('hidden')) {
            closeTargetDetailModal();
        }
        if (!document.getElementById('confirmModal').classList.contains('hidden')) {
            closeModal();
        }
    }
});

// Initialize chart on window resize
window.addEventListener('resize', function() {
    if (financeChart instanceof Chart) {
        financeChart.resize();
    }
});
