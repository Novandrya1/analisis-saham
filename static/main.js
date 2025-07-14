// static/main.js
// Berkas ini mengelola logika untuk halaman non-detail: Dashboard, Portofolio, IPO, dan Berita.
document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    window.fullData = {}; // Data global untuk diakses skrip lain
    let watchlist = JSON.parse(localStorage.getItem('watchlistV12')) || [];

    // --- Helper Functions ---
    const formatRp = (num, dec=0) => `Rp ${new Intl.NumberFormat('id-ID', {minimumFractionDigits: dec, maximumFractionDigits: dec}).format(Math.round(num))}`;
    const formatUsd = (num, dec=2) => `$${new Intl.NumberFormat('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec}).format(num)}`;
    const formatPrice = (price, market) => market === 'US' ? formatUsd(price) : formatRp(price);
    const flash = (el, change) => { const c = change >= 0 ? 'flash-green' : 'flash-red'; el.classList.add(c); setTimeout(() => el.classList.remove(c), 600); };
    const createLogo = (kode) => `<div class="logo-container"><div class="logo-svg">${kode.substring(0,4)}</div></div>`;

    // --- Page-specific Renderers ---
    const pageId = document.body.id;
    const renderers = {
        'page-halaman_utama': renderDashboard,
        'page-halaman_portofolio': () => document.addEventListener('portfolioLoaded', () => renderPortfolio(window.fullData.saham)),
        'page-halaman_ipo': renderIpo,
        'page-halaman_berita': renderBerita,
    };

    function renderDashboard() {
        if (!window.fullData.saham) return;
        renderStockTable(window.fullData.saham);
        renderMovers(window.fullData.saham);
        renderIndices(window.fullData.indeks);
    }

    function renderStockTable(stockList) {
        const stockBody = document.getElementById('stock-table-body');
        if (!stockBody) return;
        stockBody.innerHTML = '';
        stockList.forEach(s => {
            const change = s.harga - s.open_price;
            const pct = s.open_price !== 0 ? (change / s.open_price) * 100 : 0;
            stockBody.innerHTML += `<tr id="saham-${s.kode}"><td class="company-cell">${createLogo(s.kode)}<div><strong><a href="/saham/${s.kode}">${s.kode}</a></strong><small>${s.nama}</small></div></td><td class="harga">${formatPrice(s.harga, s.market)}</td><td class="change ${pct>=0?'positive':'negative'}">${pct.toFixed(2)}%</td><td class="text-center"><button class="watchlist-btn" data-kode="${s.kode}"><i class="far fa-star"></i></button></td></tr>`;
        });
        updateWatchlistButtons();
    }

    function renderMovers(sahamList) {
        const sorted = [...sahamList].sort((a, b) => ((b.harga/b.open_price)-1) - ((a.harga/a.open_price)-1));
        const gList = document.getElementById('top-gainers-list');
        const lList = document.getElementById('top-losers-list');
        if (!gList || !lList) return;
        gList.innerHTML = '';
        lList.innerHTML = '';
        sorted.slice(0, 3).forEach(s => {
            const pct = ((s.harga/s.open_price-1)*100);
            gList.innerHTML += `<div class="mover-item"><a href="/saham/${s.kode}">${s.kode}</a><span class="price">${formatPrice(s.harga, s.market)}</span><span class="change positive">+${pct.toFixed(2)}%</span></div>`;
        });
        sorted.slice(-3).reverse().forEach(s => {
            const pct = ((s.harga/s.open_price-1)*100);
            lList.innerHTML += `<div class="mover-item"><a href="/saham/${s.kode}">${s.kode}</a><span class="price">${formatPrice(s.harga, s.market)}</span><span class="change negative">${pct.toFixed(2)}%</span></div>`;
        });
    }

    function renderIndices(indexList) {
        const iList = document.getElementById('index-list');
        if (!iList) return;
        iList.innerHTML = '';
        indexList.forEach(i => {
            const change = i.harga - i.open_price;
            const pct = i.open_price !== 0 ? (change / i.open_price) * 100 : 0;
            iList.innerHTML += `<div class="mover-item" id="index-${i.kode}"><a href="/indeks/${i.kode}">${i.kode}</a><span class="price">${formatPrice(i.harga, i.market)}</span><span class="change ${pct>=0?'positive':'negative'}">${pct.toFixed(2)}%</span></div>`;
        });
    }

    function renderIpo() {
        const ipoGrid = document.getElementById('ipo-list');
        if(!ipoGrid || !window.fullData.ipo) return;
        ipoGrid.innerHTML = '';
        window.fullData.ipo.forEach(ipo => ipoGrid.innerHTML += `<div class="ipo-card"><div class="ipo-card-header">${createLogo(ipo.kode)}<h3>${ipo.kode}</h3><span>${ipo.sektor}</span></div><h4>${ipo.nama}</h4><div class="ipo-card-body"><div><span>Harga Penawaran</span><strong>${ipo.price_range}</strong></div><div><span>Ukuran Penawaran</span><strong>${ipo.offering_size_t} T</strong></div></div><div class="ipo-card-footer">Due: ${ipo.due_date}</div></div>`);
    }
    
    function renderBerita() {
        const newsGrid = document.getElementById('news-list');
        if(!newsGrid || !window.fullData.berita) return;
        newsGrid.innerHTML = '';
        window.fullData.berita.forEach(n => newsGrid.innerHTML += `<div class="news-card"><h3>${n.judul}</h3><div class="news-footer"><span>${n.sumber}</span><span>${n.waktu}</span></div></div>`);
    }

    function renderPortfolio(sahamList = window.fullData.saham) {
        if (!document.getElementById('holdingsTable') || !sahamList) return;
        let totalInv=0, totalMarket=0;
        const hBody = document.getElementById('holdings-table-body');
        hBody.innerHTML = '';
        const holdings = Object.keys(portfolio.holdings);
        if (holdings.length === 0) { hBody.innerHTML = '<tr class="loading-row"><td colspan="6">Tidak ada saham di portofolio.</td></tr>'; }
        else {
            for (const kode of holdings) {
                const h = portfolio.holdings[kode];
                const stock = sahamList.find(s => s.kode === kode);
                if (!stock) continue;
                const inv = h.lots*100*h.avgPrice;
                const marketValue = h.lots*100*stock.harga;
                const pl = marketValue - inv;
                const plPct = inv>0?(pl/inv)*100:0;
                totalInv+=inv;
                totalMarket+=marketValue;
                hBody.innerHTML += `<tr id="holding-${kode}"><td class="company-cell">${createLogo(kode)}<div><strong><a href="/saham/${kode}">${kode}</a></strong><small>${stock.nama}</small></div></td><td>${h.lots}</td><td>${formatPrice(h.avgPrice, stock.market)}</td><td class="harga">${formatPrice(stock.harga, stock.market)}</td><td class="text-right">${formatPrice(marketValue, stock.market)}</td><td class="text-right ${pl>=0?'positive':'negative'}">${formatPrice(pl, stock.market)} (${plPct.toFixed(2)}%)</td></tr>`;
            }
        }
        const totalPL = totalMarketValue - totalInv;
        const totalPLPct = totalInv>0?(totalPL/totalInv)*100:0;
        document.getElementById('total-asset-value').textContent = formatRp(totalMarketValue + portfolio.cash);
        document.getElementById('total-investment').textContent = formatRp(totalInv);
        document.getElementById('total-pl').textContent = `${formatRp(totalPL)} (${totalPLPct.toFixed(2)}%)`;
        document.getElementById('total-pl').className = `value ${totalPL>=0?'positive':'negative'}`;
        document.getElementById('cash-balance').textContent = formatRp(portfolio.cash);
        const histBody = document.getElementById('history-table-body');
        histBody.innerHTML = '';
        if (portfolio.history.length === 0) { histBody.innerHTML = '<tr class="loading-row"><td colspan="6">Tidak ada riwayat transaksi.</td></tr>'; }
        else {
            portfolio.history.slice(0,20).forEach(tx => {
                const stock = sahamList.find(s => s.kode === tx.kode);
                if (!stock) return;
                histBody.innerHTML += `<tr><td>${tx.date}</td><td>${tx.kode}</td><td class="${tx.type==='buy'?'positive':'negative'}">${tx.type.toUpperCase()}</td><td>${tx.lots}</td><td class="text-right">${formatPrice(tx.price, stock.market)}</td><td class="text-right">${formatPrice(tx.total, stock.market)}</td></tr>`;
            });
        }
    }

    function toggleWatchlist(kode) {
        const index = watchlist.indexOf(kode);
        if (index > -1) watchlist.splice(index, 1);
        else watchlist.push(kode);
        localStorage.setItem('watchlistV12', JSON.stringify(watchlist));
        updateWatchlistButtons();
    }
    
    function updateWatchlistButtons() {
        document.querySelectorAll('.watchlist-btn').forEach(btn => {
            const kode = btn.dataset.kode;
            if (watchlist.includes(kode)) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-star"></i>';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="far fa-star"></i>';
            }
        });
    }

    socket.on('initial_data', (data) => {
        window.fullData = data;
        if (renderers[pageId]) {
            renderers[pageId]();
        }
    });

    socket.on('update_harga', (data) => {
        const stock = window.fullData.saham.find(s => s.kode === data.kode);
        if (stock) {
            stock.harga = data.harga;
            stock.open_price = stock.open_price || data.harga;
        }
        const row = document.getElementById(`saham-${data.kode}`);
        if (row) {
            const hCell = row.querySelector('.harga');
            const cCell = row.querySelector('.change');
            const oldPrice = parseFloat(hCell.textContent.replace(/[Rp$.]/g, '').replace(',', '.'));
            hCell.textContent = formatPrice(data.harga, stock.market);
            cCell.textContent = `${data.change_pct.toFixed(2)}%`;
            cCell.className = `change ${data.change_pct >= 0 ? 'positive' : 'negative'}`;
            flash(row, data.harga - oldPrice);
        }
        if (pageId === 'page-halaman_utama') renderMovers(window.fullData.saham);
        if (pageId === 'page-halaman_portofolio') renderPortfolio(window.fullData.saham);
    });

    socket.on('update_indeks', (data) => {
        const index = window.fullData.indeks.find(i => i.kode === data.kode);
        if (index) {
            index.harga = data.harga;
            index.open_price = index.open_price || data.harga;
        }
        if (pageId === 'page-halaman_utama') renderIndices(window.fullData.indeks);
    });
    
    document.body.addEventListener('click', e => {
        if (e.target.closest('.watchlist-btn')) {
            toggleWatchlist(e.target.closest('.watchlist-btn').dataset.kode);
        }
    });
    
    window.filterTable = () => {
        const filter = document.getElementById("searchInput").value.toUpperCase();
        const rows = document.getElementById("stockTable").getElementsByTagName("tr");
        for (let i = 0; i < rows.length; i++) {
            const cell = rows[i].getElementsByTagName("td")[0];
            if (cell) {
                const txtValue = (cell.textContent || '');
                rows[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
        }
    };
    
    const themeSwitcher = document.getElementById('theme-switcher');
    themeSwitcher.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeSwitcher.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSwitcher.querySelector('i').className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
});
