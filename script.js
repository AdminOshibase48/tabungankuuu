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
            hargaBarang: target.hargaBarang,
            targetHarian: target.targetHarian,
            terkumpul: 0,
            createdAt: new Date().toISOString()
        });
        this.saveUserData('targets', targets);
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
            amount: transaction.amount,
            description: transaction.description,
            date: new Date().toISOString()
        });
        this.saveUserData('transactions', transactions);
    }
}

const db = new CelenganDB();

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeForms();
});

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
    loadDashboardData();
}

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
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
            alert('Username atau password salah!');
        }
    });

    // Form Register
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Password tidak cocok!');
            return;
        }
        
        const users = db.getUsers();
        if (users.find(u => u.username === username)) {
            alert('Username sudah digunakan!');
            return;
        }
        
        users.push({ username, password });
        db.saveUsers(users);
        alert('Registrasi berhasil! Silakan login.');
        showLogin();
    });

    // Form Target
    document.getElementById('targetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const target = {
            namaBarang: document.getElementById('namaBarang').value,
            hargaBarang: parseInt(document.getElementById('hargaBarang').value),
            targetHarian: parseInt(document.getElementById('targetHarian').value)
        };
        
        db.saveTarget(target);
        this.reset();
        loadDashboardData();
        alert('Target berhasil ditambahkan!');
    });

    // Form Transaksi
    document.getElementById('transactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const transaction = {
            type: document.getElementById('transactionType').value,
            amount: parseInt(document.getElementById('amount').value),
            description: document.getElementById('description').value
        };
        
        db.saveTransaction(transaction);
        this.reset();
        loadDashboardData();
        alert('Transaksi berhasil dicatat!');
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
    
    targetList.innerHTML = targets.map(target => `
        <div class="target-item">
            <strong>${target.namaBarang}</strong><br>
            Target: Rp ${target.hargaBarang.toLocaleString()}<br>
            Harian: Rp ${target.targetHarian.toLocaleString()}<br>
            Terkumpul: Rp ${target.terkumpul.toLocaleString()}<br>
            Progress: ${Math.round((target.terkumpul / target.hargaBarang) * 100)}%
        </div>
    `).join('');
}

function loadTransactions() {
    const transactions = db.getTransactions();
    const transactionHistory = document.getElementById('transactionHistory');
    
    transactionHistory.innerHTML = transactions.slice(-10).reverse().map(transaction => `
        <div class="transaction-item">
            <div>
                <strong>${transaction.description}</strong><br>
                <small>${new Date(transaction.date).toLocaleDateString('id-ID')}</small>
            </div>
            <span class="${transaction.type}">
                ${transaction.type === 'pemasukan' ? '+' : '-'} Rp ${transaction.amount.toLocaleString()}
            </span>
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
    
    // Group transactions by month
    const monthlyData = transactions.reduce((acc, transaction) => {
        const month = new Date(transaction.date).toLocaleDateString('id-ID', { month: 'long' });
        if (!acc[month]) {
            acc[month] = { pemasukan: 0, pengeluaran: 0 };
        }
        acc[month][transaction.type] += transaction.amount;
        return acc;
    }, {});
    
    const months = Object.keys(monthlyData);
    const pemasukanData = months.map(month => monthlyData[month].pemasukan);
    const pengeluaranData = months.map(month => monthlyData[month].pengeluaran);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: pemasukanData,
                    backgroundColor: '#28a745'
                },
                {
                    label: 'Pengeluaran',
                    data: pengeluaranData,
                    backgroundColor: '#dc3545'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function logout() {
    if (confirm('Yakin ingin logout?')) {
        db.logout();
        showLogin();
    }
}
