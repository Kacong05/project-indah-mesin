# -*- coding: utf-8 -*-
"""
Worker Simulasi Mesin Retort - untuk testing pengiriman data & monitoring panel.

Mode default: recorded_at = waktu nyata saat data dikirim (seperti ESP).
Setelah siklus selesai, tunggu PROCESS_GAP_MINUTES sebelum proses baru (tes reset grafik).
"""
import argparse
import os
import random
import sys
import time
from datetime import datetime, timedelta

import requests

# ─── Konfigurasi ──────────────────────────────────────────────────────────────
API_URL = "http://127.0.0.1:8000/api/sensor"
MACHINE_CODE = "RT-001"
SENSOR_API_TOKEN = "o5bCFkfwf4rQWOMlPnOkNkBNWZPXKObTaYIYfC1Mfy0="
SEND_INTERVAL_SEC = 1          # interval kirim data (detik) — sama seperti simulasi awal
PROCESS_GAP_MINUTES = 3        # jeda antar proses (sesuai backend)
HEATING_TARGET_C = 120.0       # heating selesai saat PV menyentuh 120°C
STERILIZING_ITERATIONS = 50    # durasi sterilisasi (sama seperti holding sebelumnya)
COOLING_STEP_C = 3.05          # penurunan suhu per kirim saat pendinginan
COOLING_TARGET_C = 60.0


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip().strip('"\'')


def now_recorded_at() -> str:
    """Timestamp realtime untuk field recorded_at (timezone lokal + milidetik)."""
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def health_check(machine_code: str) -> bool:
    print("\n" + "=" * 50)
    print("  HEALTH CHECK")
    print("=" * 50)

    try:
        headers = {"Authorization": f"Bearer {SENSOR_API_TOKEN}"}
        response = requests.post(
            API_URL,
            json={"test": "ping", "machine_code": machine_code},
            headers=headers,
            timeout=5,
        )
        print(f"[OK] Server & Token: HTTP {response.status_code}")
        try:
            data = response.json()
            if data.get("success"):
                print("[OK] Sensor API working - Token valid")
            else:
                print(f"[WARN] Response: {data.get('message', 'No message')}")
        except Exception:
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


def format_timer(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def wait_process_gap(minutes: int):
    gap_sec = minutes * 60
    print(f"\n[GAP] Menunggu {minutes} menit sebelum proses baru (tes reset grafik)...")
    deadline = datetime.now() + timedelta(seconds=gap_sec)
    while datetime.now() < deadline:
        remaining = (deadline - datetime.now()).total_seconds()
        print(f"  ... {format_timer(remaining)} tersisa", end="\r", flush=True)
        time.sleep(1)
    print(f"\n[GAP] Mulai proses baru — recorded_at realtime dari sekarang.")


def send_data(
    machine_code: str,
    show_panel: bool = True,
    interval_sec: float = SEND_INTERVAL_SEC,
    gap_minutes: int = PROCESS_GAP_MINUTES,
):
    temperature = 30.0
    phase = "heating"
    sterilize_counter = 0
    process_started_at = datetime.now()
    step_started_at = datetime.now()
    cycle_count = 0
    iteration = 0

    step_names = {
        "heating": "HEATING",
        "sterilizing": "STERILISASI",
        "cooling": "PENDINGINAN",
    }

    print("\n" + "=" * 60)
    print("  MULAI KIRIM DATA SENSOR (REALTIME TIMESTAMP)")
    print("=" * 60)
    print(f"  Machine Code : {machine_code}")
    print(f"  Target API   : {API_URL}")
    print(f"  Interval     : {interval_sec} detik")
    print(f"  recorded_at  : waktu nyata tiap kirim")
    print(f"  Heating      : sampai PV ≥ {HEATING_TARGET_C}°C → sterilisasi")
    print(f"  Sterilisasi  : {STERILIZING_ITERATIONS} kirim (~{STERILIZING_ITERATIONS * interval_sec:.0f}s)")
    print(f"  Pendinginan  : {COOLING_STEP_C}°C/kirim sampai {COOLING_TARGET_C}°C")
    print(f"  Gap proses   : {gap_minutes} menit antar siklus")
    print(f"  Panel Mode   : {'ON' if show_panel else 'OFF'}")
    print("=" * 60)

    while True:
        iteration += 1
        now = datetime.now()

        if phase == "heating":
            temperature += 1.82
            if temperature >= HEATING_TARGET_C:
                phase = "sterilizing"
                sterilize_counter = 0
                step_started_at = now

        elif phase == "sterilizing":
            sterilize_counter += 1
            temperature += random.uniform(-0.5, 0.5)
            temperature = max(119.0, min(123.0, temperature))
            if sterilize_counter >= STERILIZING_ITERATIONS:
                phase = "cooling"
                step_started_at = now

        elif phase == "cooling":
            temperature -= COOLING_STEP_C
            if temperature <= COOLING_TARGET_C:
                temperature = COOLING_TARGET_C
                cycle_count += 1
                print(f"\n[INFO] Siklus #{cycle_count} selesai. Menunggu gap {gap_minutes} menit...")

                wait_process_gap(gap_minutes)

                phase = "heating"
                temperature = 30.0
                sterilize_counter = 0
                process_started_at = datetime.now()
                step_started_at = datetime.now()
                print("[INFO] Proses baru dimulai.\n")

        temperature = round(temperature, 2)
        pressure = round(0.2 + (temperature / 121.0) * 2.0, 2)
        sv = 121.1 if phase in ("heating", "sterilizing") else 0.0

        if phase == "heating":
            mv = min(100.0, 70 + (temperature / 121.0) * 30)
        elif phase == "sterilizing":
            mv = random.uniform(15, 35)
        else:
            mv = 0.0

        recorded_at = now_recorded_at()
        clock_label = datetime.now().strftime("%H:%M:%S")

        total_elapsed = (now - process_started_at).total_seconds()
        step_elapsed = (now - step_started_at).total_seconds()

        payload = {
            "machine_code": machine_code,
            "temperature": temperature,
            "sv": sv,
            "pressure": pressure,
            "process_status": phase,
            "recorded_at": recorded_at,
        }

        if show_panel and iteration % 5 == 0:
            print("\n┌─────────────────────────────────────────────────────────┐")
            print("│              MONITORING PANEL - LIVE UPDATE              │")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ recorded_at        : {recorded_at:<31s}│")
            print(f"│ PV (Suhu Aktual)   : {temperature:>8.1f} °C                    │")
            print(f"│ SV (Target Suhu)   : {sv:>8.1f} °C                    │")
            print(f"│ MV (Output Kontrol) : {mv:>7.1f}  %                    │")
            print(f"│ Pressure           : {pressure:>8.2f} bar                   │")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ Status             : {phase.upper():<31s}│")
            print(f"│ Process Step       : {step_names[phase]:<31s}│")
            print("├─────────────────────────────────────────────────────────┤")
            print(f"│ Total Time         : {format_timer(total_elapsed):<31s}│")
            print(f"│ Step Time          : {format_timer(step_elapsed):<31s}│")
            print("└─────────────────────────────────────────────────────────┘")

        try:
            headers = {"Authorization": f"Bearer {SENSOR_API_TOKEN}"}
            response = requests.post(API_URL, json=payload, headers=headers, timeout=5)

            session_info = ""
            try:
                body = response.json()
                if body.get("success") and body.get("data", {}).get("session"):
                    sess = body["data"]["session"]
                    tag = " [SESI BARU]" if sess.get("is_new_session") else ""
                    session_info = f" | {sess.get('name', '')}{tag}"
            except Exception:
                pass

            if response.status_code == 200:
                print(
                    f"[{clock_label}] {phase.upper():8s} | {temperature:6.2f}°C | "
                    f"SV:{sv:5.1f} | {pressure} bar | MV:{mv:5.1f}% | "
                    f"ts={recorded_at}{session_info} | [OK]"
                )
            else:
                print(f"[{clock_label}] [GAGAL] HTTP {response.status_code}: {response.text[:100]}")

        except requests.exceptions.ConnectionError:
            print(f"[{clock_label}] [ERROR] Gagal terhubung ke {API_URL}")
            print("         Pastikan server Laravel sudah berjalan!")
            time.sleep(5)
        except Exception as e:
            print(f"[{clock_label}] [ERROR] {e}")

        time.sleep(interval_sec)


def parse_args():
    parser = argparse.ArgumentParser(description="Worker simulasi mesin retort (realtime timestamp)")
    parser.add_argument("machine_code", nargs="?", default=None, help=f"Kode mesin (default: {MACHINE_CODE})")
    parser.add_argument("--no-panel", action="store_true", help="Matikan tampilan panel di terminal")
    parser.add_argument("--interval", type=float, default=SEND_INTERVAL_SEC, help="Interval kirim (detik)")
    parser.add_argument("--gap", type=int, default=PROCESS_GAP_MINUTES, help="Jeda menit antar proses")
    return parser.parse_args()


if __name__ == "__main__":
    load_env()

    if os.environ.get("API_URL"):
        API_URL = os.environ["API_URL"]
    if os.environ.get("SENSOR_API_TOKEN"):
        SENSOR_API_TOKEN = os.environ["SENSOR_API_TOKEN"]

    args = parse_args()

    print("\n" + "=" * 50)
    print("  WORKER SIMULASI MESIN RETORT")
    print("  Timestamp realtime — untuk tes monitoring & grafik")
    print("=" * 50)

    if args.machine_code:
        machine_code = args.machine_code.strip().upper()
    else:
        print(f"\nKode Mesin [Default: {MACHINE_CODE}]: ", end="")
        user_input = input().strip()
        machine_code = user_input.upper() if user_input else MACHINE_CODE

    print(f"\nMesin Code    : {machine_code}")
    print(f"Target API    : {API_URL}")
    print(f"Token         : {SENSOR_API_TOKEN[:20]}...")
    print(f"Interval      : {args.interval}s")
    print(f"Gap proses    : {args.gap} menit")

    if not health_check(machine_code):
        print("\n[ERROR] Health check gagal. Perbaiki koneksi terlebih dahulu.")
        sys.exit(1)

    print("\nTekan Ctrl+C untuk berhenti.\n")

    try:
        send_data(
            machine_code,
            show_panel=not args.no_panel,
            interval_sec=args.interval,
            gap_minutes=args.gap,
        )
    except KeyboardInterrupt:
        print("\n\nWorker dihentikan.")
        sys.exit(0)
