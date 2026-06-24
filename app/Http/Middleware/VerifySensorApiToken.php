<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySensorApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('sensor.api_token');

        if (empty($expected)) {
            return response()->json([
                'success' => false,
                'message' => 'Sensor API token not configured on server.',
            ], 503);
        }

        $token = $request->bearerToken() ?? $request->header('X-Sensor-Token');

        if (! is_string($token) || ! hash_equals($expected, $token)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        return $next($request);
    }
}
