// static/screener.js
document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    let fullStockData = [];
    const marketFilter = document.getElementById('marketFilter');
    const sektorFilter = document.getElementById('sektorFilter');
    const marketCapFilter = document.getElementById('marketCapFilter');
    const tableBody = document.getElementById('screener-table-body');
    const createLogo = (kode) => `<div class="logo-container"><div class="logo-svg">${kode.substring(0,4)}</div></div>`;

    function applyFilters() {
        const market = marketFilter.value;
        const sektor = sektorFilter.value;
        const marketCap = marketCapFilter.value;
        const filtered = fullStockData.filter(s => {
            const marketMatch = (market === 'all') || (s.market === market);
            const sektorMatch = (sektor === 'all') || (s.sektor === sektor);
            let capMatch = true;
            if (marketCap === 'small') capMatch = s.market_cap_t < 100;
            else if (marketCap === 'medium') capMatch = s.market_cap_t >= 100 && s.market_cap_t <= 500;
            else if (marketCap === 'large') capMatch = s.market_cap_t > 500;
            return marketMatch && sektorMatch && capMatch;
        });
        renderTable(filtered);
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada saham yang cocok.</td></tr>';
            return;
        }
        data.forEach(s => {
            tableBody.innerHTML += `<tr><td class="company-cell">${createLogo(s.kode)}<div><strong><a href="/saham/${s.kode}">${s.kode}</a></strong><small>${s.nama}</small></div></td><td>${s.sektor}</td><td class="text-right">${s.market_cap_t} T</td><td class="text-right">${s.pe_ratio || 'N/A'}</td></tr>`;
        });
    }

    socket.on('initial_data', function(data) {
        fullStockData = data.saham;
        const sektors = [...new Set(fullStockData.map(s => s.sektor))];
        sektorFilter.innerHTML = '<option value="all">Semua Sektor</option>';
        sektors.forEach(s => sektorFilter.innerHTML += `<option value="${s}">${s}</option>`);
        applyFilters();
    });

    marketFilter.addEventListener('change', applyFilters);
    sektorFilter.addEventListener('change', applyFilters);
    marketCapFilter.addEventListener('change', applyFilters);
});
