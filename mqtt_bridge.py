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
import sys
import time

import paho.mqtt.client as mqtt
import requests

MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "retort/data")
MQTT_USER = os.getenv("MQTT_USER", "")
MQTT_PASS = os.getenv("MQTT_PASS", "")


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

# Default port 8080 (deploy.sh APP_PORT); override via Environment= di systemd
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


def on_message(client, userdata, msg):
    try:
        raw = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON tidak valid: {e}")
        return

    esp_id = raw.get("id") or raw.get("machine_code", "")
    logging = raw.get("logging", False)
    if isinstance(logging, str):
        logging = logging.lower() in ("true", "1", "yes")

    phase = str(raw.get("phase", raw.get("process_status", "idle"))).lower()
    process_status = "logging" if logging else phase

    payload = {
        "machine_code": esp_id,
        "temperature": float(raw.get("actual", raw.get("temperature", 0))),
        "pressure": float(raw.get("pressure", 0)),
        "process_status": process_status,
    }

    if not SENSOR_API_TOKEN:
        print("[ERROR] SENSOR_API_TOKEN belum diset — data tidak dikirim ke Laravel")
        return

    try:
        r = requests.post(API_URL, json=payload, headers=api_headers(), timeout=10)
        if r.status_code == 200:
            print(f"[OK] {esp_id} | {payload['temperature']}°C | {payload['process_status']}")
        else:
            print(f"[GAGAL] HTTP {r.status_code}: {r.text[:120]}")
    except requests.RequestException as e:
        print(f"[ERROR] POST ke Laravel: {e}")


def main():
    print("=" * 50)
    print("  MQTT Bridge → Laravel → PostgreSQL")
    print("=" * 50)
    print(f"  MQTT   : {MQTT_HOST}:{MQTT_PORT}  topic={MQTT_TOPIC}")
    print(f"  API    : {API_URL}")
    print(f"  Auth   : MQTT={'ya' if MQTT_USER else 'tidak'}, API token={'ya' if SENSOR_API_TOKEN else 'TIDAK'}")
    print("  Ctrl+C untuk berhenti.\n")

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:
        client = mqtt.Client()

    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)

    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, 60)
            client.loop_forever()
        except KeyboardInterrupt:
            print("\nBridge dihentikan.")
            sys.exit(0)
        except Exception as e:
            print(f"[ERROR] {e} — retry 5 detik...")
            time.sleep(5)


if __name__ == "__main__":
    main()
