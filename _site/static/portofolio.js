// static/portfolio.js
// Berkas ini mengelola semua logika terkait portofolio virtual.
// Data disimpan di localStorage browser agar tetap ada saat halaman dimuat ulang.

const portfolio = {
    cash: 100000000, // Modal awal 100 Juta
    holdings: {},    // Contoh: { "BBCA": { lots: 10, avgPrice: 9000 }, ... }
    history: []      // Riwayat transaksi
};

/**
 * Inisialisasi portofolio dari localStorage saat aplikasi pertama kali dimuat.
 */
function initPortfolio() {
    const savedPortfolio = JSON.parse(localStorage.getItem('stockPortfolioV12'));
    if (savedPortfolio) {
        portfolio.cash = savedPortfolio.cash || 100000000;
        portfolio.holdings = savedPortfolio.holdings || {};
        portfolio.history = savedPortfolio.history || [];
    }
    // Memberi tahu skrip lain bahwa portofolio sudah siap.
    document.dispatchEvent(new Event('portfolioLoaded'));
}

/**
 * Menyimpan kondisi portofolio saat ini ke localStorage.
 */
function savePortfolio() {
    localStorage.setItem('stockPortfolioV12', JSON.stringify(portfolio));
}

/**
 * Fungsi inti untuk mengeksekusi transaksi Beli atau Jual.
 * @param {string} kode - Kode saham (misal: 'BBCA').
 * @param {string} type - Tipe transaksi ('buy' atau 'sell').
 * @param {number} lots - Jumlah lot yang ditransaksikan.
 * @param {number} price - Harga per lembar saham.
 * @returns {boolean} - True jika berhasil, false jika gagal.
 */
function executeTrade(kode, type, lots, price) {
    const shares = lots * 100;
    const total = shares * price;

    if (type === 'buy') {
        if (portfolio.cash < total) {
            alert('Uang tunai tidak cukup untuk melakukan transaksi ini!');
            return false;
        }
        portfolio.cash -= total;
        
        const existingHolding = portfolio.holdings[kode];
        if (existingHolding) {
            // Jika sudah punya, hitung harga rata-rata baru (averaging)
            const newTotalShares = (existingHolding.lots * 100) + shares;
            const newTotalValue = (existingHolding.lots * 100 * existingHolding.avgPrice) + total;
            existingHolding.avgPrice = newTotalValue / newTotalShares;
            existingHolding.lots += lots;
        } else {
            // Jika saham baru
            portfolio.holdings[kode] = { lots: lots, avgPrice: price };
        }
    } else { // type === 'sell'
        const existingHolding = portfolio.holdings[kode];
        if (!existingHolding || existingHolding.lots < lots) {
            alert('Jumlah lot yang Anda miliki tidak cukup untuk dijual!');
            return false;
        }
        portfolio.cash += total;
        existingHolding.lots -= lots;
        if (existingHolding.lots === 0) {
            delete portfolio.holdings[kode]; // Hapus dari portofolio jika sudah habis
        }
    }

    // Catat transaksi ke riwayat
    portfolio.history.unshift({
        date: new Date().toISOString().split('T')[0],
        kode,
        type,
        lots,
        price,
        total
    });
    
    savePortfolio(); // Simpan perubahan
    return true;
}

// Jalankan inisialisasi saat skrip dimuat
document.addEventListener('DOMContentLoaded', initPortfolio);
