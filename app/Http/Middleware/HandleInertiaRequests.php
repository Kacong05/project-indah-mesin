<?php

namespace App\Http\Middleware;

use App\Models\Alarm;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'notifications' => function () use ($request) {
                if (!$request->user() || $request->user()->isAdmin()) {
                    return ['items' => [], 'unread_count' => 0];
                }

                $machineId = $request->user()->machine_id;

                $alarms = Alarm::with('machine')
                    ->where('machine_id', $machineId)
                    ->whereNull('acknowledged_by')
                    ->latest('triggered_at')
                    ->take(5)
                    ->get()
                    ->map(fn($alarm) => [
                        'id' => $alarm->id,
                        'machine_name' => $alarm->machine?->name ?? 'Unknown',
                        'message' => $alarm->message,
                        'severity' => $alarm->severity,
                        'type' => ucwords(str_replace('_', ' ', $alarm->type)),
                        'triggered_at' => $alarm->triggered_at?->diffForHumans() ?? '-',
                    ]);

                $unreadCount = Alarm::where('machine_id', $machineId)
                    ->whereNull('acknowledged_by')
                    ->count();

                return [
                    'items' => $alarms,
                    'unread_count' => $unreadCount,
                ];
            },
        ];
    }
}
