# -*- coding: utf-8 -*-
import requests
import time
import random
import datetime
import sys

# ─── Konfigurasi ──────────────────────────────────────────────────────────────
API_URL          = "http://127.0.0.1:8000/api/sensor"
MACHINE_CODE     = "RT-001"
SENSOR_API_TOKEN = "o5bCFkfwf4rQWOMlPnOkNkBNWZPXKObTaYIYfC1Mfy0="   # sama dengan SENSOR_API_TOKEN di .env

# ─── Simulasi fase proses retort ─────────────────────────────────────────────
def send_data(machine_code: str):
    temperature  = 30.0 # start at 30
    phase        = "heating"
    hold_counter = 0

    simulated_time = datetime.datetime.now()

    while True:
        simulated_time += datetime.timedelta(seconds=30)
        
        # ── HEATING (0-25 mins = 50 iterasi) ─────────────────────────────────
        if phase == "heating":
            temperature += 1.82 # (121 - 30) / 50 = 1.82
            if temperature >= 121.0:
                temperature = 121.0
                phase = "holding"

        # ── HOLDING (25-50 mins = 50 iterasi) ────────────────────────────────
        elif phase == "holding":
            hold_counter += 1
            temperature += random.uniform(-0.5, 0.5)
            temperature = max(119.0, min(123.0, temperature))
            
            if hold_counter >= 50:
                phase = "cooling"
                hold_counter = 0

        # ── COOLING (50-x mins to 60°C) ──────────────────────────────────────
        elif phase == "cooling":
            temperature -= 3.05 # (121 - 60) / 20 = 3.05 (takes 10 mins simulated)
            if temperature <= 60.0:
                temperature = 60.0
                print("\n[INFO] Selesai cooling di 60°C. Memulai siklus baru...\n")
                phase = "heating"
                temperature = 30.0
                # Loncat 2 menit agar API membuat sesi proses baru
                simulated_time += datetime.timedelta(minutes=2)

        temperature = round(temperature, 2)
        pressure    = round(0.2 + (temperature / 121.0) * 2.0, 2)

        # Format datetime untuk backend (YYYY-MM-DD HH:MM:SS)
        recorded_at = simulated_time.strftime("%Y-%m-%d %H:%M:%S")
        timestamp = simulated_time.strftime("%H:%M:%S")

        payload = {
            "machine_code":   machine_code,
            "temperature":    temperature,
            "sv":             121.1 if phase != 'cooling' else 0,
            "pressure":       pressure,
            "process_status": phase,
            "recorded_at":    recorded_at
        }

        try:
            print(f"[{timestamp}] {phase.upper():7s} | Suhu={temperature:.2f}°C | Tekanan={pressure} bar", end=" ... ")
            headers = {"Authorization": f"Bearer {SENSOR_API_TOKEN}"}
            response = requests.post(API_URL, json=payload, headers=headers, timeout=5)

            if response.status_code == 200:
                print("[OK] Sukses")
            else:
                print(f"[GAGAL] HTTP {response.status_code}: {response.text[:80]}")

        except requests.exceptions.ConnectionError:
            print(f"[ERROR] Gagal terhubung ke {API_URL}")
        except Exception as e:
            print(f"[ERROR] {e}")

        # Jalankan cepat (1 detik real = 30 detik simulasi)
        time.sleep(1)


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 42)
    print("  WORKER SIMULASI MESIN RETORT")
    print("=" * 42)

    if len(sys.argv) > 1:
        MACHINE_CODE = sys.argv[1].strip().upper()
    else:
        user_input = input(f"Masukkan Kode/Seri Mesin [Default: {MACHINE_CODE}]: ").strip()
        if user_input:
            MACHINE_CODE = user_input.upper()

    print(f"Mesin Code : {MACHINE_CODE}")
    print(f"Target API : {API_URL}")
    print("Tekan Ctrl+C untuk berhenti.\n")

    try:
        send_data(MACHINE_CODE)
    except KeyboardInterrupt:
        print("\nWorker dihentikan.")
