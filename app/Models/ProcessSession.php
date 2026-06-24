<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcessSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'started_at',
        'ended_at',
        'data_count',
        'status',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    /**
     * Relasi ke data sensor dalam sesi ini
     */
    public function sensorReadings(): HasMany
    {
        return $this->hasMany(SensorReading::class);
    }

    /**
     * Scope: hanya sesi yang masih aktif
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: sesi yang sudah selesai
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope: urutkan dari terbaru
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('started_at', 'desc');
    }

    /**
     * Format display name (Proses 1, Proses 2, dst)
     */
    public function getDisplayNameAttribute(): string
    {
        if ($this->name) {
            return $this->name;
        }

        // Hitung nomor proses berdasarkan ID (atau bisa berdasarkan created_at)
        $count = self::where('id', '<=', $this->id)->count();
        return "Proses {$count}";
    }

    /**
     * Format rentang waktu (17.00 - 17.18)
     */
    public function getTimeRangeAttribute(): string
    {
        $start = $this->started_at->format('H:i');
        $end = $this->ended_at ? $this->ended_at->format('H:i') : '...';

        return "{$start} - {$end}";
    }

    /**
     * Durasi sesi dalam menit
     */
    public function getDurationInMinutesAttribute(): ?int
    {
        if (!$this->ended_at) {
            return null;
        }

        return $this->started_at->diffInMinutes($this->ended_at);
    }
}
