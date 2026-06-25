<?php

use Illuminate\Foundation\Application;
Route::get('/', function () {
    return redirect()->route('login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    // Operator Routes
    Route::middleware([\App\Http\Middleware\EnsureIsOperator::class])->group(function () {
        Route::get('/dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])->name('dashboard');
        Route::get('/monitoring', [\App\Http\Controllers\MonitoringController::class, 'index'])->name('monitoring');
        Route::post('/dashboard/command', [\App\Http\Controllers\MachineCommandController::class, 'store'])->name('dashboard.command');
        Route::get('/history', [\App\Http\Controllers\HistoryController::class, 'index'])->name('history');
        Route::get('/history/export', [\App\Http\Controllers\HistoryController::class, 'export'])->name('history.export');
        Route::post('/history/log-export', [\App\Http\Controllers\HistoryController::class, 'logExport'])->name('history.log-export');
        Route::get('/retort-monitor', fn () => inertia('RetortMonitor'))->name('retort.monitor');
    });
    
    // Admin Routes
    Route::middleware([\App\Http\Middleware\EnsureIsAdmin::class])->group(function () {
        Route::get('/users', [\App\Http\Controllers\UserController::class, 'index'])->name('users');
        Route::get('/users/create', [\App\Http\Controllers\UserController::class, 'create'])->name('users.create');
        Route::post('/users', [\App\Http\Controllers\UserController::class, 'store'])->name('users.store');
        Route::get('/users/{user}/edit', [\App\Http\Controllers\UserController::class, 'edit'])->name('users.edit');
        Route::put('/users/{user}', [\App\Http\Controllers\UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [\App\Http\Controllers\UserController::class, 'destroy'])->name('users.destroy');
    });
});

require __DIR__.'/auth.php';

// API Endpoint for Sensor (wajib token — lihat SENSOR_API_TOKEN di .env)
Route::post('/api/sensor', [\App\Http\Controllers\Api\SensorController::class, 'store'])
    ->middleware('sensor.token')
    ->name('api.sensor');
