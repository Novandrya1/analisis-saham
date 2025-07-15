document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculate-btn');
    if (!calculateBtn) return; // Hanya jalankan jika tombol ada di halaman

    const formatRp = (num) => `Rp ${new Intl.NumberFormat('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0}).format(num)}`;

    calculateBtn.addEventListener('click', () => {
        const P = parseFloat(document.getElementById('initial-investment').value);
        const PMT = parseFloat(document.getElementById('monthly-contribution').value);
        const r = parseFloat(document.getElementById('interest-rate').value) / 100;
        const t = parseInt(document.getElementById('years').value);
        const n = 12; // Bunga dimajemukkan setiap bulan

        if (isNaN(P) || isNaN(PMT) || isNaN(r) || isNaN(t)) {
            alert("Harap isi semua kolom dengan angka yang valid.");
            return;
        }

        const nt = n * t;
        // Rumus nilai masa depan dari investasi awal
        const principalFutureValue = P * Math.pow(1 + r / n, nt);
        // Rumus nilai masa depan dari anuitas (kontribusi bulanan)
        const contributionFutureValue = PMT * ((Math.pow(1 + r / n, nt) - 1) / (r / n));
        
        const finalValue = principalFutureValue + contributionFutureValue;
        
        const totalInvestment = P + (PMT * 12 * t);
        const totalGain = finalValue - totalInvestment;

        document.getElementById('result-total-investment').textContent = formatRp(totalInvestment);
        document.getElementById('result-total-gain').textContent = formatRp(totalGain);
        document.getElementById('result-final-value').textContent = formatRp(finalValue);
        document.getElementById('calculator-result').style.display = 'block';
    });
});
