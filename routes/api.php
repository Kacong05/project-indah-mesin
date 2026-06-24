<?php

use App\Http\Controllers\Api\HistoryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Routes untuk API sensor dan history
|
*/

// Routes untuk history/session
Route::prefix('history')->group(function () {
    // Daftar semua sesi
    Route::get('/sessions', [HistoryController::class, 'sessions'])
        ->name('api.history.sessions');

    // Detail satu sesi
    Route::get('/sessions/{id}', [HistoryController::class, 'sessionDetail'])
        ->name('api.history.session-detail')
        ->whereNumber('id');

    // Sesi terbaru
    Route::get('/latest', [HistoryController::class, 'latestSession'])
        ->name('api.history.latest');

    // Re-assign data lama (untuk migrasi/fixing)
    Route::post('/reassign', [HistoryController::class, 'reassignData'])
        ->name('api.history.reassign');
});
