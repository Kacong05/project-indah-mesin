<?php

namespace App\Http\Controllers;

use App\Models\ProductionBatch;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        $today   = Carbon::today();
        $month   = Carbon::now()->startOfMonth();

        // Jumlah proses (batch) per user — semua status
        $userBatchStats = User::where('role', User::ROLE_OPERATOR)
            ->with(['machine'])
            ->withCount([
                'operatedBatches as total_batches',
                'operatedBatches as batches_today' => fn ($q) =>
                    $q->whereDate('created_at', $today),
                'operatedBatches as batches_this_month' => fn ($q) =>
                    $q->where('created_at', '>=', $month),
                'operatedBatches as completed_batches' => fn ($q) =>
                    $q->where('status', ProductionBatch::STATUS_COMPLETED),
                'operatedBatches as in_progress_batches' => fn ($q) =>
                    $q->where('status', ProductionBatch::STATUS_IN_PROGRESS),
                'operatedBatches as failed_batches' => fn ($q) =>
                    $q->where('status', ProductionBatch::STATUS_FAILED),
            ])
            ->orderByDesc('total_batches')
            ->get()
            ->map(fn ($user) => [
                'id'                  => $user->id,
                'name'                => $user->name,
                'email'               => $user->email,
                'machine_name'        => $user->machine?->name ?? '-',
                'machine_code'        => $user->machine?->machine_code ?? '-',
                'total_batches'       => $user->total_batches,
                'batches_today'       => $user->batches_today,
                'batches_this_month'  => $user->batches_this_month,
                'completed_batches'   => $user->completed_batches,
                'in_progress_batches' => $user->in_progress_batches,
                'failed_batches'      => $user->failed_batches,
            ]);

        // Ringkasan global
        $summary = [
            'total_operators'       => User::where('role', User::ROLE_OPERATOR)->count(),
            'total_batches'         => ProductionBatch::count(),
            'batches_today'         => ProductionBatch::whereDate('created_at', $today)->count(),
            'batches_this_month'    => ProductionBatch::where('created_at', '>=', $month)->count(),
            'completed_batches'     => ProductionBatch::where('status', ProductionBatch::STATUS_COMPLETED)->count(),
            'in_progress_batches'   => ProductionBatch::where('status', ProductionBatch::STATUS_IN_PROGRESS)->count(),
            'failed_batches'        => ProductionBatch::where('status', ProductionBatch::STATUS_FAILED)->count(),
        ];

        return Inertia::render('Admin/Dashboard', [
            'userBatchStats' => $userBatchStats,
            'summary'        => $summary,
        ]);
    }
}
