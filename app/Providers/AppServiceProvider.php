<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Force HTTPS saat di belakang reverse proxy (Nginx → PHP-FPM)
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }
    }
}
