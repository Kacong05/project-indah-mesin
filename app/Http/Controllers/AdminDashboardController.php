<?php

namespace App\Http\Controllers;

use App\Models\ProcessSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        $today = Carbon::today();
        $month = Carbon::now()->startOfMonth();

        // Jumlah proses (ProcessSession) per operator
        // ProcessSession → machine_id → RetortMachine → User
        $userStats = User::where('role', User::ROLE_OPERATOR)
            ->with('machine')
            ->get()
            ->map(function ($user) use ($today, $month) {
                $machineId = $user->machine_id;

                $base = ProcessSession::when($machineId, fn($q) => $q->where('machine_id', $machineId));

                $total       = (clone $base)->count();
                $todayCount  = (clone $base)->whereDate('started_at', $today)->count();
                $monthCount  = (clone $base)->where('started_at', '>=', $month)->count();
                $completed   = (clone $base)->where(function ($q) {
                    $q->where('status', 'completed')
                      ->orWhere(function ($q2) {
                          // status masih 'active' di DB tapi updated_at sudah > 1 menit (accessor logic)
                          $q2->where('status', 'active')
                             ->where('updated_at', '<', now()->subMinute());
                      });
                })->count();
                $active      = (clone $base)->where('status', 'active')
                                            ->where('updated_at', '>=', now()->subMinute())
                                            ->count();

                return [
                    'id'                  => $user->id,
                    'name'                => $user->name,
                    'email'               => $user->email,
                    'machine_name'        => $user->machine?->name ?? '-',
                    'machine_code'        => $user->machine?->machine_code ?? '-',
                    'total_batches'       => $total,
                    'batches_today'       => $todayCount,
                    'batches_this_month'  => $monthCount,
                    'completed_batches'   => $completed,
                    'in_progress_batches' => $active,
                    'failed_batches'      => 0,
                ];
            })
            ->sortByDesc('total_batches')
            ->values();

        // Ringkasan global
        $summary = [
            'total_operators'       => User::where('role', User::ROLE_OPERATOR)->count(),
            'total_batches'         => ProcessSession::count(),
            'batches_today'         => ProcessSession::whereDate('started_at', $today)->count(),
            'batches_this_month'    => ProcessSession::where('started_at', '>=', $month)->count(),
            'completed_batches'     => ProcessSession::where(function ($q) {
                $q->where('status', 'completed')
                  ->orWhere(function ($q2) {
                      $q2->where('status', 'active')
                         ->where('updated_at', '<', now()->subMinute());
                  });
            })->count(),
            'in_progress_batches'   => ProcessSession::where('status', 'active')
                                                     ->where('updated_at', '>=', now()->subMinute())
                                                     ->count(),
            'failed_batches'        => 0,
        ];

        return Inertia::render('Admin/Dashboard', [
            'userBatchStats' => $userStats,
            'summary'        => $summary,
        ]);
    }
}
