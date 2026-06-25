# -*- coding: utf-8 -*-
"""
Worker Simulasi Mesin Retort - untuk testing pengiriman data & monitoring panel
"""
import requests
import time
import random
import datetime
import sys
import os

# ─── Konfigurasi ──────────────────────────────────────────────────────────────
API_URL          = "http://127.0.0.1:8000/api/sensor"
MACHINE_CODE     = "RT-001"
SENSOR_API_TOKEN = "o5bCFkfwf4rQWOMlPnOkNkBNWZPXKObTaYIYfC1Mfy0="

# ─── Load dari .env jika ada ─────────────────────────────────────────────────
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"\'')

# ─── Health Check ─────────────────────────────────────────────────────────────
def health_check():
    """Cek apakah API server dan endpoint sensor accessible."""
    print("\n" + "=" * 50)
    print("  HEALTH CHECK")
    print("=" * 50)

    try:
        headers = {"Authorization": f"Bearer {SENSOR_API_TOKEN}"}
        response = requests.post(API_URL, json={"test": "ping", "machine_code": MACHINE_CODE}, headers=headers, timeout=5)
        print(f"[OK] Server & Token: HTTP {response.status_code}")
        try:
            data = response.json()
            if data.get('success'):
                print(f"[OK] Sensor API working - Token valid")
            else:
                print(f"[WARN] Response: {data.get('message', 'No message')}")
        except:
            print(f"[INFO] Response: {response.text[:100]}")
    except requests.exceptions.ConnectionError:
        print("[ERROR] Server tidak accessible!")
        print("        Pastikan Laravel sudah berjalan: php artisan serve")
        return False
    except requests.exceptions.Timeout:
        print("[ERROR] Connection timeout!")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

    print("-" * 50)
    return True


# ─── Format Timer ─────────────────────────────────────────────────────────────
def format_timer(seconds):
    """Format seconds ke HH:MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


# ─── Simulasi fase proses retort ─────────────────────────────────────────────
def send_data(machine_code: str, show_panel: bool = True):
    temperature   = 30.0
    phase         = "heating"
    hold_counter  = 0
    sim_seconds   = 0
    step_seconds  = 0
    cycle_count   = 0

    # Phase durations (simulated seconds, 1 real second = 30 simulated seconds)
    PHASE_DURATIONS = {
        'heating': 25 * 60,   # 25 min heating
        'holding': 25 * 60,    # 25 min holding
        'cooling': 10 * 60,    # 10 min cooling
    }

    # Process step names untuk display
    STEP_NAMES = {
        'heating': 'HEATING',
        'holding': 'HOLDING',
        'cooling': 'COOLING',
    }

    # Mulai dari waktu sekarang
    simulated_time = datetime.datetime.now()
    iteration = 0

    print("\n" + "=" * 60)
    print("  MULAI KIRIM DATA SENSOR")
    print("=" * 60)
    print(f"  Machine Code : {machine_code}")
    print(f"  Target API   : {API_URL}")
    print(f"  Interval     : 1 detik real = 30 detik simulasi")
    print(f"  Panel Mode   : {'ON' if show_panel else 'OFF'}")
    print("=" * 60)

    while True:
        iteration += 1
        simulated_time += datetime.timedelta(seconds=30)
        sim_seconds += 30
        step_seconds += 30

        # ── HEATING (0-25 mins) ──────────────────────────────────────────────
        if phase == "heating":
            temperature += 1.82
            if temperature >= 121.0:
                temperature = 121.0
                phase = "holding"
                step_seconds = 0

        # ── HOLDING (25-50 mins) ─────────────────────────────────────────────
        elif phase == "holding":
            hold_counter += 1
            temperature += random.uniform(-0.5, 0.5)
            temperature = max(119.0, min(123.0, temperature))

            if hold_counter >= 50:
                phase = "cooling"
                hold_counter = 0
                step_seconds = 0

        # ── COOLING (50-60 mins) ──────────────────────────────────────────────
        elif phase == "cooling":
            temperature -= 3.05
            if temperature <= 60.0:
                temperature = 60.0
                cycle_count += 1
                print(f"\n[INFO] Siklus #{cycle_count} selesai di 60°C. Reset & mulai siklus baru...")

                # Reset untuk siklus baru (mulai dari awal)
                simulated_time += datetime.timedelta(minutes=2, seconds=10)  # Skip 2+ menit
                sim_seconds += 130
                step_seconds = 0
                phase = "heating"
                temperature = 30.0
                hold_counter = 0

        temperature = round(temperature, 2)
        pressure = round(0.2 + (temperature / 121.0) * 2.0, 2)

        # SV (Set Value) - target suhu
        sv = 121.1 if phase in ('heating', 'holding') else 0

        # MV (Manipulated Value) - simulasi output kontrol
        if phase == 'heating':
            mv = min(100, 70 + (temperature / 121.0) * 30)
        elif phase == 'holding':
            mv = random.uniform(15, 35)
        else:
            mv = 0

        # Calculate remaining time
        phase_duration = PHASE_DURATIONS.get(phase, 0)
        remaining = max(0, phase_duration - step_seconds)

        # Format datetime untuk backend
        recorded_at = simulated_time.strftime("%Y-%m-%d %H:%M:%S")
        timestamp = simulated_time.strftime("%H:%M:%S")

        payload = {
            "machine_code": machine_code,
            "temperature": temperature,
            "sv": sv,
            "pressure": pressure,
            "process_status": phase,
            "recorded_at": recorded_at
        }

        # ── Tampilkan output monitoring panel ──────────────────────────────
        if show_panel and iteration % 5 == 0:  # Update setiap 5 iterasi
            print("\n┌─────────────────────────────────────────────────────────┐")
            print("│              MONITORING PANEL - LIVE UPDATE              │")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ PV (Suhu Aktual)   : {temperature:>8.1f} °C                    │")
            print(f"│ SV (Target Suhu)   : {sv:>8.1f} °C                    │")
            print(f"│ MV (Output Kontrol) : {mv:>7.1f}  %                    │")
            print(f"│ Pressure           : {pressure:>8.2f} bar                   │")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ Status             : {phase.upper():<31s}│")
            print(f"│ Process Step       : {STEP_NAMES[phase]:<31s}│")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ Total Time         : {format_timer(sim_seconds):<31s}│")
            print(f"│ Step Time          : {format_timer(step_seconds):<31s}│")
            print(f"│ Remaining (Step)   : {format_timer(remaining):<31s}│")
            print("└─────────────────────────────────────────────────────────┘")

        # ── Kirim ke API ────────────────────────────────────────────────────
        try:
            headers = {"Authorization": f"Bearer {SENSOR_API_TOKEN}"}
            response = requests.post(API_URL, json=payload, headers=headers, timeout=5)

            if response.status_code == 200:
                print(f"[{timestamp}] {phase.upper():8s} | {temperature:6.2f}°C | SV:{sv:5.1f} | {pressure} bar | MV:{mv:5.1f}% | [OK]")
            else:
                print(f"[{timestamp}] [GAGAL] HTTP {response.status_code}: {response.text[:100]}")

        except requests.exceptions.ConnectionError:
            print(f"[{timestamp}] [ERROR] Gagal terhubung ke {API_URL}")
            print("         Pastikan server Laravel sudah berjalan!")
            time.sleep(5)
        except Exception as e:
            print(f"[{timestamp}] [ERROR] {e}")

        time.sleep(1)


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Load .env jika ada
    load_env()

    # Override config dari environment jika ada
    if os.environ.get('API_URL'):
        API_URL = os.environ['API_URL']
    if os.environ.get('SENSOR_API_TOKEN'):
        SENSOR_API_TOKEN = os.environ['SENSOR_API_TOKEN']

    print("\n" + "=" * 50)
    print("  WORKER SIMULASI MESIN RETORT")
    print("  Untuk Testing Pengiriman Data & Monitoring Panel")
    print("=" * 50)

    # Parse argument
    if len(sys.argv) > 1:
        if sys.argv[1] == '--no-panel':
            show_panel = False
            machine_code = sys.argv[2] if len(sys.argv) > 2 else MACHINE_CODE
        else:
            machine_code = sys.argv[1].strip().upper()
            show_panel = True
    else:
        print(f"\nKode Mesin [Default: {MACHINE_CODE}]: ", end="")
        user_input = input().strip()
        machine_code = user_input.upper() if user_input else MACHINE_CODE
        show_panel = True

    print(f"\nMesin Code    : {machine_code}")
    print(f"Target API    : {API_URL}")
    print(f"Token         : {SENSOR_API_TOKEN[:20]}...")
    print()

    # Health check dulu
    if not health_check():
        print("\n[ERROR] Health check gagal. Perbaiki koneksi terlebih dahulu.")
        sys.exit(1)

    print("\nTekan Ctrl+C untuk berhenti.\n")

    try:
        send_data(machine_code, show_panel)
    except KeyboardInterrupt:
        print("\n\nWorker dihentikan.")
        sys.exit(0)
