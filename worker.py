import requests
import time
import random
import datetime

# Konfigurasi
API_URL = "http://127.0.0.1:8000/api/sensor"
MACHINE_CODE = "RT-002"  # Sesuaikan dengan kode mesin di database

def send_data():
    while True:
        # Simulasi data sensor
        temperature = round(random.uniform(115.0, 125.0), 2)
        pressure = round(random.uniform(1.5, 2.5), 2)
        
        payload = {
            "machine_code": MACHINE_CODE,
            "temperature": temperature,
            "pressure": pressure,
            "process_status": "running"
        }
        
        try:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Mengirim data: Suhu={temperature}°C, Tekanan={pressure} bar...")
            response = requests.post(API_URL, json=payload, timeout=5)
            
            if response.status_code == 200:
                print(f"✅ Sukses: {response.json()}")
            else:
                print(f"❌ Gagal ({response.status_code}): {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error koneksi: {e}")
            
        # Tunggu 5 detik sebelum mengirim data berikutnya
        time.sleep(5)

if __name__ == "__main__":
    import sys
    
    print("=" * 40)
    print("WORKER SIMULASI MESIN RETORT")
    print("=" * 40)
    
    # Ambil dari argument command line, atau minta input jika kosong
    if len(sys.argv) > 1:
        MACHINE_CODE = sys.argv[1]
    else:
        user_input = input(f"Masukkan Kode/Seri Mesin [Default: {MACHINE_CODE}]: ").strip()
        if user_input:
            MACHINE_CODE = user_input.toUpperCase() if hasattr(user_input, 'toUpperCase') else user_input.upper()

    print(f"Mesin Code : {MACHINE_CODE}")
    print(f"Target API : {API_URL}")
    print("Tekan Ctrl+C untuk berhenti.\n")
    try:
        send_data()
    except KeyboardInterrupt:
        print("\nWorker dihentikan.")
