# -*- coding: utf-8 -*-
import requests
import time
import random
import datetime
import sys

# ─── Konfigurasi ──────────────────────────────────────────────────────────────
API_URL      = "http://127.0.0.1:8000/api/sensor"
MACHINE_CODE = "RT-002"

# ─── Simulasi fase proses retort ─────────────────────────────────────────────
def send_data(machine_code: str):
    temperature  = 0.0
    phase        = "heating"
    hold_counter = 0

    while True:
        # ── HEATING ──────────────────────────────────────────────────────────
        if phase == "heating":
            if temperature < 30:
                temperature += random.uniform(2.0, 4.0)
            elif temperature < 80:
                temperature += random.uniform(1.0, 2.0)
            elif temperature < 115:
                temperature += random.uniform(0.5, 1.2)
            elif temperature < 121:
                temperature += random.uniform(0.1, 0.5)
            else:
                temperature = 121.0
                phase = "holding"

        # ── HOLDING ──────────────────────────────────────────────────────────
        elif phase == "holding":
            hold_counter += 1
            temperature  += random.uniform(-0.3, 0.3)
            temperature   = max(119.0, min(123.0, temperature))  # clamp around target

            # 30 siklus × 5 detik = 150 detik sterilisasi
            if hold_counter >= 30:
                phase        = "cooling"
                hold_counter = 0

        # ── COOLING ──────────────────────────────────────────────────────────
        elif phase == "cooling":
            temperature -= random.uniform(0.5, 2.0)

            if temperature <= 30.0:
                temperature  = 0.0
                phase        = "heating"

        temperature = round(temperature, 2)
        pressure    = round(0.2 + (temperature / 121.0) * 2.0, 2)

        payload = {
            "machine_code":   machine_code,
            "temperature":    temperature,
            "pressure":       pressure,
            "process_status": phase,
        }

        timestamp = datetime.datetime.now().strftime("%H:%M:%S")

        try:
            print(f"[{timestamp}] {phase.upper():7s} | Suhu={temperature:.2f}°C | Tekanan={pressure} bar", end=" ... ")

            response = requests.post(API_URL, json=payload, timeout=5)

            if response.status_code == 200:
                print("[OK] Sukses")
            else:
                print(f"[GAGAL] HTTP {response.status_code}: {response.text[:80]}")

        except requests.exceptions.ConnectionError:
            print(f"[ERROR] Gagal terhubung ke {API_URL}")
        except requests.exceptions.Timeout:
            print("[ERROR] Timeout -- server tidak merespons")
        except Exception as e:
            print(f"[ERROR] {e}")

        time.sleep(5)


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
