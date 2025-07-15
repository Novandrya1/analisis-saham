from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import json, time, random
from threading import Thread, Event
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'the-most-advanced-secret-key-v13'
socketio = SocketIO(app)

data_store = {}
thread_stop_event = Event()

def generate_historical_data(base_price, days=365):
    data, price = [], base_price
    today = datetime.now()
    base_volume = random.randint(1000000, 5000000)
    for i in range(days):
        date = (today - timedelta(days=days - i - 1)).strftime('%Y-%m-%d')
        open_price = price * (1 + random.uniform(-0.01, 0.01))
        close_price = open_price * (1 + random.uniform(-0.03, 0.03))
        high_price = max(open_price, close_price) * (1 + random.uniform(0, 0.015))
        low_price = min(open_price, close_price) * (1 - random.uniform(0, 0.015))
        price = close_price
        volume = int(base_volume * random.uniform(0.7, 1.3))
        data.append({"x": date, "o": round(open_price, 2), "h": round(high_price, 2), "l": round(low_price, 2), "c": round(close_price, 2), "v": volume})
    return data

def load_initial_data():
    global data_store
    with open('data.json', 'r', encoding='utf-8') as f: data_store = json.load(f)
    base_prices = {"BBCA": 9350, "BBRI": 4450, "BMRI": 6100, "BBNI": 4600, "TLKM": 3100, "ASII": 5150, "GOTO": 55, "UNVR": 3400, "ICBP": 11000, "ADRO": 2800, "PTBA": 2500, "MDKA": 2600, "ANTM": 1500, "KLBF": 1550, "SIDO": 750, "ARTO": 2300, "EXCL": 2400, "AAPL": 210, "GOOGL": 180, "TSLA": 185}
    for saham in data_store.get('saham', []):
        is_us = saham.get('market') == 'US'
        hist_data = generate_historical_data(base_prices.get(saham['kode'], 1000))
        saham['historical'] = hist_data
        saham['open_price'] = hist_data[-1]['o']
        saham['harga'] = hist_data[-1]['c']
    for indeks in data_store.get('indeks', []):
        is_us = indeks.get('market') == 'US'
        base_price = 17000 if is_us else 7200
        hist_data = generate_historical_data(base_price)
        indeks['historical'] = hist_data
        indeks['open_price'] = hist_data[-1]['o']
        indeks['harga'] = hist_data[-1]['c']

def simulate_realtime_updates():
    while not thread_stop_event.is_set():
        time.sleep(random.uniform(0.5, 1.5))
        if not data_store.get('saham'): continue
        items_to_update = data_store['saham'] + data_store['indeks']
        
        for item in items_to_update:
            old_price = item['harga']
            item['harga'] = round(old_price * (1 + random.uniform(-0.005, 0.005)), 2)
            change = item['harga'] - item['open_price']
            change_pct = (change / item['open_price']) * 100 if item['open_price'] != 0 else 0
            event_name = 'update_indeks' if 'historical' in item and item.get('market') and 'sektor' not in item else 'update_harga'
            socketio.emit(event_name, {'kode': item['kode'], 'harga': item['harga'], 'change': round(change, 2), 'change_pct': round(change_pct, 2)})

# --- Routes ---
@app.route('/')
def halaman_utama(): return render_template('index.html')

@app.route('/portofolio')
def halaman_portofolio(): return render_template('portofolio.html')

@app.route('/ipo')
def halaman_ipo(): return render_template('ipo.html')

@app.route('/screener')
def halaman_screener(): return render_template('screener.html')

@app.route('/berita')
def halaman_berita(): return render_template('berita.html')

@app.route('/kalkulator')
def halaman_kalkulator(): return render_template('kalkulator.html')

@app.route('/saham/<kode_saham>')
def halaman_detail_saham(kode_saham):
    item = next((s for s in data_store.get('saham', []) if s['kode'] == kode_saham.upper()), None)
    return render_template('detail.html', item=item, item_type='saham') if item else ("Saham tidak ditemukan", 404)

@app.route('/indeks/<kode_indeks>')
def halaman_detail_indeks(kode_indeks):
    item = next((i for i in data_store.get('indeks', []) if i['kode'] == kode_indeks.upper()), None)
    return render_template('detail.html', item=item, item_type='indeks') if item else ("Indeks tidak ditemukan", 404)

# --- API Endpoint for Comparison ---
@app.route('/api/stock_data/<kode_saham>')
def get_stock_data(kode_saham):
    item = next((s for s in data_store.get('saham', []) if s['kode'] == kode_saham.upper()), None)
    if item: return jsonify(item)
    return jsonify({"error": "Stock not found"}), 404

# --- Socket.IO ---
@socketio.on('connect')
def handle_connect():
    if data_store: emit('initial_data', data_store)

if __name__ == '__main__':
    load_initial_data()
    thread = Thread(target=simulate_realtime_updates)
    thread.daemon = True
    thread.start()
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
