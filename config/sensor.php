<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Sensor API Token
    |--------------------------------------------------------------------------
    |
    | Token untuk endpoint POST /api/sensor (mqtt_bridge, worker simulasi).
    | Kirim via header: Authorization: Bearer <token>
    | atau: X-Sensor-Token: <token>
    |
    */
    'api_token' => env('SENSOR_API_TOKEN'),

];
