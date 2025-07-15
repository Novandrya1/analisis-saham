document.addEventListener('DOMContentLoaded', function() {
    // Pastikan data awal dari server ada sebelum melanjutkan
    if (typeof initialData === 'undefined') {
        console.error("Kesalahan: Data awal (initialData) tidak ditemukan. Halaman tidak dapat dimuat.");
        return;
    }

    const socket = io();
    let myChart, myMacdChart;
    let currentChartType = 'candlestick';
    let currentTimeframe = 180;
    let currentPrice = initialData.harga;
    let activeIndicators = { sma20: false, sma50: false, bb: false, macd: false };

    // --- Helper Functions ---
    const formatPrice = (price, market, dec = 2) => market === 'US' ? `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(price)}` : `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(price))}`;
    const flash = (el, change) => { const c = change >= 0 ? 'flash-green' : 'flash-red'; el.classList.add(c); setTimeout(() => el.classList.remove(c), 600); };
    const createLogo = (kode) => `<div class="logo-container"><div class="logo-svg">${kode.substring(0, 4)}</div></div>`;

    // --- Indicator Calculation Functions ---
    const calculateSMA = (data, period) => { let sma = []; for (let i = 0; i < data.length; i++) { if (i < period - 1) { sma.push({x: data[i].x, y: null}); } else { let sum = 0; for (let j = 0; j < period; j++) { sum += data[i - j].c; } sma.push({x: data[i].x, y: sum / period}); } } return sma; };
    const calculateEMA = (data, period) => { let ema = []; if (data.length === 0) return []; let multiplier = 2 / (period + 1); ema.push({x: data[0].x, y: data[0].c}); for (let i = 1; i < data.length; i++) { let newEma = (data[i].c - ema[i - 1].y) * multiplier + ema[i - 1].y; ema.push({x: data[i].x, y: newEma}); } return ema; };
    const calculateMACD = (data) => { if(data.length < 26) return {macdLine:[], signalLine:[], histogram:[]}; const ema12 = calculateEMA(data, 12).map(d=>d.y); const ema26 = calculateEMA(data, 26).map(d=>d.y); const macdLine = ema12.map((val, i) => val - ema26[i]); const signalLineData = macdLine.map((val,i) => ({x:data[i].x, c:val})); const signalLine = calculateEMA(signalLineData, 9).map(d=>d.y); const histogram = macdLine.map((val, i) => val - signalLine[i]); return {macdLine, signalLine, histogram}; };
    const calculateBB = (data, period=20, stdDev=2) => { let bb = {middle:[], upper:[], lower:[]}; for(let i=0; i<data.length; i++){ if(i<period-1){bb.middle.push(null); bb.upper.push(null); bb.lower.push(null);} else { const slice = data.slice(i-period+1, i+1); const avg = slice.reduce((acc, val) => acc + val.c, 0) / period; let std_dev_val = Math.sqrt(slice.reduce((acc, val) => acc + Math.pow(val.c - avg, 2), 0) / period); bb.middle.push({x:data[i].x, y:avg}); bb.upper.push({x:data[i].x, y:avg + stdDev * std_dev_val}); bb.lower.push({x:data[i].x, y:avg - stdDev * std_dev_val}); }} return bb; };

    // --- Main Chart Rendering Logic ---
    function renderChart() {
        const ctx = document.getElementById('detailChart')?.getContext('2d');
        if (!ctx) return;

        const slicedData = initialData.historical.slice(-currentTimeframe);
        const priceData = (currentChartType === 'candlestick') ? slicedData : slicedData.map(d => ({ x: d.x, y: d.c }));
        
        const datasets = [{
            label: initialData.kode,
            data: priceData,
            yAxisID: 'y',
            order: 1 // Pastikan harga/candlestick digambar di atas indikator area
        }];

        // Tambahkan indikator jika aktif
        if (activeIndicators.sma20) datasets.push({ label: 'SMA 20', data: calculateSMA(slicedData, 20), type: 'line', borderColor: 'orange', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y', order: 0 });
        if (activeIndicators.sma50) datasets.push({ label: 'SMA 50', data: calculateSMA(slicedData, 50), type: 'line', borderColor: 'purple', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y', order: 0 });
        if (activeIndicators.bb) {
            const bbData = calculateBB(slicedData);
            datasets.push({label:'BB Upper', data:bbData.upper, type:'line', borderColor:'rgba(100,100,255,0.4)', borderWidth:1, pointRadius:0, yAxisID:'y', order: 0});
            datasets.push({label:'BB Lower', data:bbData.lower, type:'line', borderColor:'rgba(100,100,255,0.4)', borderWidth:1, pointRadius:0, yAxisID:'y', fill: '-1', backgroundColor: 'rgba(100,100,255,0.1)', order: 0});
        }
        if (initialData.sektor) { // Hanya tampilkan volume untuk saham, bukan indeks
            const volData = slicedData.map(d => ({ x: d.x, y: d.v, backgroundColor: d.c >= d.o ? 'rgba(63,185,80,0.5)' : 'rgba(248,81,73,0.5)' }));
            datasets.push({ label: 'Volume', data: volData, type: 'bar', yAxisID: 'y2', order: 2 });
        }
        
        if (myChart) myChart.destroy();
        
        myChart = new Chart(ctx, {
            type: currentChartType,
            data: { datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'month' }, adapters: { date: { locale: 'en-US' } }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
                    y: { position: 'left', grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#8b949e' } },
                    y2: { display: !!initialData.sektor, position: 'right', grid: { drawOnChartArea: false }, ticks: { display: false }, max: Math.max(...(initialData.historical.map(v => v.v))) * 4 }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                interaction: { mode: 'index', intersect: false }
            }
        });
        
        renderMacdChart(activeIndicators.macd);
    }

    function renderMacdChart(show) {
        const container = document.getElementById('macd-chart-container');
        const ctx = document.getElementById('macdChart')?.getContext('2d');
        if (!container || !ctx) return;
        
        container.style.display = show ? 'block' : 'none';
        if (!show) {
            if (myMacdChart) myMacdChart.destroy();
            return;
        }

        const slicedData = initialData.historical.slice(-currentTimeframe);
        const { macdLine, signalLine, histogram } = calculateMACD(slicedData);
        
        if (myMacdChart) myMacdChart.destroy();
        myMacdChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: slicedData.map(d => d.x),
                datasets: [
                    { label: 'MACD', data: macdLine, type: 'line', borderColor: '#58a6ff', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y' },
                    { label: 'Signal', data: signalLine, type: 'line', borderColor: '#f9a825', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y' },
                    { label: 'Histogram', data: histogram, backgroundColor: (c) => c.raw >= 0 ? 'rgba(63,185,80,0.5)' : 'rgba(248,81,73,0.5)', yAxisID: 'y' }
                ]
            },
            options: { responsive:true, maintainAspectRatio:false, scales:{x:{display:false}, y:{display:true, grid:{color:'rgba(255,255,255,0.1)'}}}, plugins:{legend:{display:false}} }
        });
    }

    // --- Other UI Rendering ---
    function updateOrderBook() {
        const bidBook = document.getElementById('bid-book'), offerBook = document.getElementById('offer-book');
        if (!bidBook) return;
        bidBook.innerHTML = ''; offerBook.innerHTML = '';
        for (let i = 0; i < 10; i++) {
            const bidPrice = currentPrice * (1 - (i + 1) * 0.001);
            const offerPrice = currentPrice * (1 + (i + 1) * 0.001);
            bidBook.innerHTML += `<tr><td>${Math.floor(Math.random() * 2000)}</td><td class="bid-price">${formatPrice(bidPrice, initialData.market)}</td></tr>`;
            offerBook.innerHTML += `<tr><td class="offer-price">${formatPrice(offerPrice, initialData.market)}</td><td>${Math.floor(Math.random() * 2000)}</td></tr>`;
        }
    }

    function renderAnalystChart() {
        const container = document.getElementById('analyst-chart-container');
        if (!container || !initialData.analyst_rating) return;
        const r = initialData.analyst_rating, total = r.buy + r.hold + r.sell;
        container.innerHTML = `<div class="analyst-bar"><div class="bar-buy" style="width:${(r.buy / total) * 100}%"></div><div class="bar-hold" style="width:${(r.hold / total) * 100}%"></div><div class="bar-sell" style="width:${(r.sell / total) * 100}%"></div></div><div class="analyst-legend"><div><span class="dot-buy"></span>Buy (${r.buy})</div><div><span class="dot-hold"></span>Hold (${r.hold})</div><div><span class="dot-sell"></span>Sell (${r.sell})</div></div>`;
    }

    function renderRelatedNews() {
        const newsList = document.getElementById('news-list');
        if (!newsList) return;
        
        const renderNews = (data) => {
            const relatedNews = data.berita.filter(n => n.tags.includes(initialData.kode));
            newsList.innerHTML = '';
            if (relatedNews.length === 0) {
                newsList.innerHTML = '<p class="empty-watchlist">Tidak ada berita terkait.</p>';
                return;
            }
            relatedNews.forEach(n => newsList.innerHTML += `<div class="news-card"><h3>${n.judul}</h3><div class="news-footer"><span>${n.sumber}</span><span>${n.waktu}</span></div></div>`);
        };
        
        if (window.fullData && window.fullData.berita) {
            renderNews(window.fullData);
        } else {
            socket.on('initial_data', renderNews);
        }
    }
    
    function updateTradePanel() {
        const lotInput = document.getElementById('trade-lot');
        if (!lotInput) return;
        const lots = parseInt(lotInput.value) || 0;
        document.getElementById('trade-price').textContent = formatPrice(currentPrice, initialData.market);
        document.getElementById('trade-total').textContent = formatPrice(lots * 100 * currentPrice, initialData.market);
    }
    
    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('show'); }, 100);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    // --- Event Listeners ---
    document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => {
        document.querySelector('.tab-button.active')?.classList.remove('active');
        document.querySelector('.tab-content.active')?.classList.remove('active');
        b.classList.add('active');
        document.getElementById(b.dataset.tab)?.classList.add('active');
    }));
    
    document.getElementById('timeframe-controls')?.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            currentTimeframe = parseInt(e.target.dataset.period);
            document.querySelector('#timeframe-controls .active')?.classList.remove('active');
            e.target.classList.add('active');
            renderChart();
        }
    });

    document.getElementById('chart-type-controls')?.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (btn) {
            currentChartType = btn.dataset.type;
            document.querySelector('#chart-type-controls .active')?.classList.remove('active');
            btn.classList.add('active');
            renderChart();
        }
    });

    document.querySelectorAll('.indicator-controls input').forEach(cb => cb.addEventListener('change', e => {
        activeIndicators[e.target.dataset.indicator] = e.target.checked;
        renderChart();
    }));

    let tradeType = 'buy';
    document.getElementById('btn-buy')?.addEventListener('click', () => {
        tradeType = 'buy';
        document.getElementById('btn-buy').classList.add('active');
        document.getElementById('btn-sell').classList.remove('active');
        document.getElementById('btn-confirm-trade').className = 'btn-trade btn-buy';
        document.getElementById('btn-confirm-trade').textContent = 'Konfirmasi Beli';
    });
    document.getElementById('btn-sell')?.addEventListener('click', () => {
        tradeType = 'sell';
        document.getElementById('btn-sell').classList.add('active');
        document.getElementById('btn-buy').classList.remove('active');
        document.getElementById('btn-confirm-trade').className = 'btn-trade btn-sell';
        document.getElementById('btn-confirm-trade').textContent = 'Konfirmasi Jual';
    });
    document.getElementById('btn-confirm-trade')?.addEventListener('click', () => {
        const lots = parseInt(document.getElementById('trade-lot').value);
        if (lots > 0) {
            if (executeTrade(initialData.kode, tradeType, lots, currentPrice)) {
                showToast(`Transaksi ${tradeType.toUpperCase()} ${lots} lot ${initialData.kode} berhasil!`);
            }
        } else {
            alert('Jumlah lot tidak valid');
        }
    });
    
    document.getElementById('btn-set-alert')?.addEventListener('click', () => {
        const target = document.getElementById('alert-price').value;
        const condition = document.getElementById('alert-condition').value;
        if(target > 0) {
            socket.emit('set_price_alert', { kode: initialData.kode, target, condition });
        } else {
            alert('Target harga tidak valid');
        }
    });

    document.getElementById('trade-lot')?.addEventListener('input', updateTradePanel);
    
    // --- Socket.IO Real-time Update Logic ---
    const updatePrice = (data) => {
        const oldPrice = currentPrice;
        currentPrice = data.harga;
        
        const pBox = document.getElementById('detail-price-box');
        document.getElementById('detail-price').textContent = formatPrice(data.harga, initialData.market, 2);
        const cEl = document.getElementById('detail-change');
        cEl.textContent = `${data.change.toFixed(2)} (${data.change_pct.toFixed(2)}%)`;
        cEl.className = `change ${data.change >= 0 ? 'positive' : 'negative'}`;
        flash(pBox, data.harga - oldPrice);
        updateTradePanel();

        // **PERBAIKAN GRAFIK REAL-TIME**
        if (myChart && myChart.data.datasets.length > 0) {
            const chartData = myChart.data.datasets[0].data;
            if (chartData.length > 0) {
                const lastDataPoint = chartData[chartData.length - 1];
                lastDataPoint.c = data.harga;
                lastDataPoint.h = Math.max(lastDataPoint.h, data.harga);
                lastDataPoint.l = Math.min(lastDataPoint.l, data.harga);
                myChart.update('none'); // Update chart tanpa animasi agar lebih cepat
            }
        }
    };

    const eventName = initialData.sektor ? 'update_harga' : 'update_indeks';
    socket.on(eventName, (data) => {
        if (data.kode === initialData.kode) {
            updatePrice(data);
        }
    });
    
    socket.on('alert_set_confirmation', (data) => {
        if (data.kode === initialData.kode) {
            showToast(`Notifikasi untuk ${data.kode} pada harga ${data.target} berhasil dipasang.`);
        }
    });
    
    socket.on('price_alert_triggered', (data) => {
        showToast(`ALERT: ${data.kode} telah mencapai harga ${formatPrice(data.price, initialData.market)} (target: ${data.condition} ${data.target})`);
    });

    // --- Initial Calls ---
    document.getElementById('logo-container-detail').innerHTML = createLogo(initialData.kode);
    const notesArea = document.getElementById('personal-notes');
    if (notesArea) {
        notesArea.value = localStorage.getItem(`notes_${initialData.kode}`) || '';
        document.getElementById('save-notes-btn').addEventListener('click', () => {
            localStorage.setItem(`notes_${initialData.kode}`, notesArea.value);
            showToast('Catatan disimpan!');
        });
    }

    renderChart();
    renderAnalystChart();
    updateOrderBook();
    setInterval(updateOrderBook, 2500);
    updateTradePanel();
    renderRelatedNews();
});
