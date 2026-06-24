<?php

return [

    /*
    |--------------------------------------------------------------------------
    | MQTT Broker (untuk kirim perintah START/STOP ke ESP32)
    |--------------------------------------------------------------------------
    |
    | User `retort_web` punya hak write ke topic retort/cmd (lihat deploy.sh ACL).
    |
    */

    'host' => env('MQTT_HOST', '127.0.0.1'),

    'port' => (int) env('MQTT_PORT', 1883),

    'user' => env('MQTT_USER', ''),

    'password' => env('MQTT_PASSWORD', ''),

    'cmd_topic' => env('MQTT_CMD_TOPIC', 'retort/cmd'),

];
