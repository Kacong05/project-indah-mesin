<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcessSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'machine_id',
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
     * Mesin retort yang menjalankan sesi ini.
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(RetortMachine::class, 'machine_id');
    }

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
     * Scope: urutkan dari terbaru (berdasarkan started_at).
     *
     * Sengaja TIDAK memakai nama `latest` agar tidak menimpa method bawaan
     * Eloquent `latest()` yang mengurutkan berdasarkan `created_at`.
     */
    public function scopeLatestStarted($query)
    {
        return $query->orderBy('started_at', 'desc');
    }

    /**
     * Format display name — gunakan nama yang tersimpan di DB.
     * Nama di-set permanen saat sesi dibuat sehingga tidak berubah
     * meski ada sesi lain yang dihapus.
     */
    public function getDisplayNameAttribute(): string
    {
        if (!empty($this->name)) {
            return $this->name;
        }

        // Fallback: urutan kronologis global per mesin (bukan reset harian)
        $query = self::query()
            ->where('started_at', '<=', $this->started_at)
            ->where('id', '<=', $this->id);

        if ($this->machine_id) {
            $query->where('machine_id', $this->machine_id);
        }

        return 'Proses ' . $query->count();
    }

    /**
     * Format rentang waktu (17.00 - 17.18)
     * Jika started_at == ended_at, tampilkan hanya satu waktu
     */
    public function getTimeRangeAttribute(): string
    {
        $start = $this->started_at->format('H:i');

        // Jika ended_at null atau sama dengan started_at, tampilkan hanya waktu mulai
        if (!$this->ended_at || $this->started_at->equalTo($this->ended_at)) {
            return $start;
        }

        $end = $this->ended_at->format('H:i');
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

    /**
     * Get the dynamically calculated status.
     * Jika status di DB 'active', tapi sudah lebih dari 1 menit sejak data terakhir (berdasarkan waktu server nyata),
     * anggap statusnya sudah 'completed'.
     */
    public function getStatusAttribute($value): string
    {
        if ($value === 'active' && $this->updated_at) {
            // Gunakan absolute difference pada updated_at (waktu nyata server menerima data)
            if (abs($this->updated_at->diffInMinutes(now(), false)) >= 1) {
                return 'completed';
            }
        }

        return $value;
    }
}
