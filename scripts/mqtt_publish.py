#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Publish satu pesan ke topic MQTT (dipanggil dari Laravel MqttCommandService)."""

import os
import sys

try:
    import paho.mqtt.publish as publish
except ImportError:
    print("ERROR: paho-mqtt belum terpasang. pip install paho-mqtt", file=sys.stderr)
    sys.exit(2)

if len(sys.argv) < 2 or not sys.argv[1].strip():
    print("ERROR: payload kosong", file=sys.stderr)
    sys.exit(1)

message = sys.argv[1].strip()
host = os.getenv("MQTT_HOST", "127.0.0.1")
port = int(os.getenv("MQTT_PORT", "1883"))
topic = os.getenv("MQTT_CMD_TOPIC", "retort/cmd")
user = os.getenv("MQTT_USER", "")
passwd = os.getenv("MQTT_PASS", "")

auth = {"username": user, "password": passwd} if user else None

try:
    publish.single(
        topic,
        payload=message,
        hostname=host,
        port=port,
        auth=auth,
        qos=1,
    )
except Exception as exc:
    print(f"ERROR: {exc}", file=sys.stderr)
    sys.exit(1)
