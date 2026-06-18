<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'machine_id',
    'acknowledged_by',
    'type',
    'severity',
    'message',
    'metadata',
    'status',
    'triggered_at',
    'resolved_at',
])]
class Alarm extends Model
{
    /**
     * Alarm type constants.
     */
    public const TYPE_HIGH_TEMPERATURE = 'high_temperature';
    public const TYPE_HIGH_PRESSURE = 'high_pressure';
    public const TYPE_SENSOR_OFFLINE = 'sensor_offline';
    public const TYPE_MACHINE_ERROR = 'machine_error';

    /**
     * Severity constants.
     */
    public const SEVERITY_WARNING = 'warning';
    public const SEVERITY_CRITICAL = 'critical';

    /**
     * Status constants.
     */
    public const STATUS_ACTIVE = 'active';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_RESOLVED = 'resolved';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'triggered_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    /**
     * Scope: only active alarms.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Scope: only critical alarms.
     */
    public function scopeCritical(Builder $query): Builder
    {
        return $query->where('severity', self::SEVERITY_CRITICAL);
    }

    /**
     * Get the machine that triggered this alarm.
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(RetortMachine::class, 'machine_id');
    }

    /**
     * Get the user who acknowledged this alarm.
     */
    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }
}
