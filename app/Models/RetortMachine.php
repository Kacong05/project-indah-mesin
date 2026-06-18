<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'machine_code',
    'name',
    'location',
    'status',
    'description',
    'last_heartbeat_at',
])]
class RetortMachine extends Model
{
    /**
     * Status constants.
     */
    public const STATUS_RUNNING = 'running';
    public const STATUS_STANDBY = 'standby';
    public const STATUS_MAINTENANCE = 'maintenance';
    public const STATUS_OFFLINE = 'offline';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_heartbeat_at' => 'datetime',
        ];
    }

    /**
     * Get the sensor readings for this machine.
     */
    public function sensorReadings(): HasMany
    {
        return $this->hasMany(SensorReading::class, 'machine_id');
    }

    /**
     * Get the alarms for this machine.
     */
    public function alarms(): HasMany
    {
        return $this->hasMany(Alarm::class, 'machine_id');
    }

    /**
     * Get the production batches for this machine.
     */
    public function productionBatches(): HasMany
    {
        return $this->hasMany(ProductionBatch::class, 'machine_id');
    }

    /**
     * Get the alarm threshold for this machine.
     */
    public function alarmThreshold(): HasOne
    {
        return $this->hasOne(AlarmThreshold::class, 'machine_id');
    }

    /**
     * Get the latest sensor reading for this machine.
     */
    public function latestReading(): HasOne
    {
        return $this->hasOne(SensorReading::class, 'machine_id')->latestOfMany('recorded_at');
    }

    /**
     * Get active alarms for this machine.
     */
    public function activeAlarms(): HasMany
    {
        return $this->hasMany(Alarm::class, 'machine_id')->where('status', 'active');
    }

    /**
     * Get the user (owner/operator) assigned to this machine.
     */
    public function owner(): HasOne
    {
        return $this->hasOne(User::class, 'machine_id');
    }
}
