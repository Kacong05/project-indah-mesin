#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mqtt_bridge.py  –  Jembatan MQTT (ESP32) → Laravel API → PostgreSQL

Butuh:
  - MQTT user/pass (Mosquitto dengan ACL)
  - SENSOR_API_TOKEN (header ke Laravel /api/sensor)
"""

import json
import os
import queue
import re
import sys
import threading
import time

import paho.mqtt.client as mqtt
import requests

MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "retort/data")
MQTT_ACK_TOPIC = os.getenv("MQTT_ACK_TOPIC", "retort/ack")
MQTT_USER = os.getenv("MQTT_USER", "")
MQTT_PASS = os.getenv("MQTT_PASS", "")

_POST_QUEUE: queue.Queue = queue.Queue(maxsize=8000)
_POST_WORKERS = int(os.getenv("MQTT_BRIDGE_WORKERS", "1"))
_POST_RETRIES = 3
_mqtt_client: mqtt.Client | None = None
_mqtt_lock = threading.Lock()


def _read_laravel_env() -> dict:
    """Fallback: baca .env jika variabel tidak di-set systemd/shell."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(env_path):
        return {}
    out = {}
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            out[key.strip()] = val.strip().strip('"').strip("'")
    return out


_laravel_env = _read_laravel_env()

_default_api = "http://127.0.0.1:8080/api/sensor"
API_URL = os.getenv("API_URL") or _laravel_env.get("MQTT_BRIDGE_API_URL") or _default_api
SENSOR_API_TOKEN = os.getenv("SENSOR_API_TOKEN") or _laravel_env.get("SENSOR_API_TOKEN", "")


def api_headers():
    if not SENSOR_API_TOKEN:
        return {}
    return {
        "Authorization": f"Bearer {SENSOR_API_TOKEN}",
        "X-Sensor-Token": SENSOR_API_TOKEN,
    }


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"[MQTT] Terhubung ke {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"[MQTT] Subscribe: {MQTT_TOPIC}")
    else:
        print(f"[MQTT] Gagal connect, code={reason_code}")


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_float_or_none(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes")
    return bool(value)


def _normalize_recorded_at(raw: dict) -> str | None:
    """
    Normalisasi timestamp ESP → ISO-8601 +07:00.
    WAJIB ada agar recorded_at di DB = waktu ukur mesin, bukan now() server
    (now() saat catch-up = banyak baris timestamp identik + detik hilang).
    """
    iso = raw.get("iso")
    if iso and "T" in str(iso):
        return str(iso).strip()

    ts = raw.get("ts")
    if not ts:
        return None

    ts = str(ts).strip()
    if "T" in ts and re.match(r"\d{4}-\d{2}-\d{2}T", ts):
        return ts

    # Human ESP/CSV: M/D/YYYY h:mm:ssAM
    m = re.match(
        r"^(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM|am|pm)?$",
        ts,
    )
    if m:
        mo, d, y, h, mi, s, ampm = m.groups()
        h = int(h)
        if ampm and ampm.upper() == "PM" and h < 12:
            h += 12
        elif ampm and ampm.upper() == "AM" and h == 12:
            h = 0
        return (
            f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
            f"T{h:02d}:{int(mi):02d}:{int(s):02d}+07:00"
        )

    return None


def _publish_ack(machine_code: str, recorded_at: str) -> None:
    """Kabari ESP bahwa baris ini sudah aman di DB → offset SD boleh maju."""
    global _mqtt_client
    if not _mqtt_client or not recorded_at:
        return
    ack = json.dumps({"id": machine_code, "iso": recorded_at})
    with _mqtt_lock:
        _mqtt_client.publish(MQTT_ACK_TOPIC, ack, qos=1)


def _post_worker(worker_id: int):
    """Worker thread: POST ke Laravel + kirim MQTT ack."""
    while True:
        payload = _POST_QUEUE.get()
        try:
            body = {}
            ok = False
            for attempt in range(1, _POST_RETRIES + 1):
                try:
                    r = requests.post(
                        API_URL, json=payload, headers=api_headers(), timeout=10
                    )
                except requests.RequestException as e:
                    print(f"[ERROR] POST ke Laravel (coba {attempt}): {e}")
                    time.sleep(0.3 * attempt)
                    continue

                if r.status_code != 200:
                    print(f"[GAGAL] HTTP {r.status_code}: {r.text[:120]}")
                    time.sleep(0.3 * attempt)
                    continue

                body = r.json() if r.content else {}
                ok = True
                break

            if not ok:
                print(
                    f"[DROP] {payload.get('machine_code')} @ "
                    f"{payload.get('recorded_at')} — gagal setelah {_POST_RETRIES}x"
                )
                continue

            recorded_at = payload.get("recorded_at", "")
            machine_code = payload.get("machine_code", "")

            # ACK ke ESP: sukses simpan, duplikat, atau live preview (MV=0 — offset tetap maju)
            if body.get("recorded") or body.get("duplicate") or body.get("live"):
                _publish_ack(machine_code, recorded_at)

            if body.get("recorded") and not body.get("duplicate"):
                sv = payload.get("sv")
                sv_txt = f" | SV {sv}°C" if sv is not None else ""
                ts_txt = f" @ {recorded_at}" if recorded_at else ""
                print(
                    f"[OK] {machine_code} | "
                    f"{payload['temperature']}°C{sv_txt} | "
                    f"{payload['process_status']}{ts_txt}"
                )
        finally:
            _POST_QUEUE.task_done()


def on_message(client, userdata, msg):
    try:
        raw = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON tidak valid: {e}")
        return

    esp_id = raw.get("id") or raw.get("machine_code", "")
    logging = _to_bool(raw.get("logging", False))

    phase = str(raw.get("phase", raw.get("process_status", "idle"))).lower()
    _MEANINGFUL_PHASES = {"heating", "holding", "sterilizing", "cooling"}
    if phase in _MEANINGFUL_PHASES:
        process_status = phase
    else:
        process_status = "logging" if logging else phase

    recorded_at = _normalize_recorded_at(raw)
    if not recorded_at:
        print(f"[WARN] {esp_id} dibuang — field iso/ts tidak valid (data tak masuk DB)")
        return

    payload = {
        "machine_code": esp_id,
        "temperature": _to_float(raw.get("actual", raw.get("temperature", 0))),
        "sv": _to_float_or_none(raw.get("setting", raw.get("sv"))),
        "mv": _to_float(raw.get("mv", 0)),
        "pressure": _to_float(raw.get("pressure", 0)),
        "process_status": process_status,
        "logging": logging,
        "recorded_at": recorded_at,
    }

    if not SENSOR_API_TOKEN:
        print("[ERROR] SENSOR_API_TOKEN belum diset — data tidak dikirim ke Laravel")
        return

    try:
        _POST_QUEUE.put_nowait(payload)
    except queue.Full:
        print("[ERROR] Antrian POST penuh — pesan MQTT dibuang (perbesar maxsize)")


def main():
    print("=" * 50)
    print("  MQTT Bridge → Laravel → PostgreSQL")
    print("=" * 50)
    print(f"  MQTT   : {MQTT_HOST}:{MQTT_PORT}  topic={MQTT_TOPIC}  ack={MQTT_ACK_TOPIC}")
    print(f"  API    : {API_URL}")
    print(f"  Auth   : MQTT={'ya' if MQTT_USER else 'tidak'}, API token={'ya' if SENSOR_API_TOKEN else 'TIDAK'}")
    print(f"  Workers: {_POST_WORKERS} thread POST (1 = urutan recorded_at terjaga)")
    print("  Ctrl+C untuk berhenti.\n")

    for i in range(_POST_WORKERS):
        t = threading.Thread(target=_post_worker, args=(i,), daemon=True)
        t.start()

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:
        client = mqtt.Client()

    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)

    global _mqtt_client
    _mqtt_client = client

    client.on_connect = on_connect
    client.on_message = on_message

    client.loop_start()
    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, 60)
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nBridge dihentikan.")
            client.loop_stop()
            sys.exit(0)
        except Exception as e:
            print(f"[ERROR] {e} — retry 5 detik...")
            time.sleep(5)


if __name__ == "__main__":
    main()
