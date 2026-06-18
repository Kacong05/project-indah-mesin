<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'machine_id',
    'operator_id',
    'batch_number',
    'product_name',
    'status',
    'notes',
    'started_at',
    'finished_at',
])]
class ProductionBatch extends Model
{
    /**
     * Status constants.
     */
    public const STATUS_PENDING = 'pending';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * Get the machine used for this batch.
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(RetortMachine::class, 'machine_id');
    }

    /**
     * Get the operator responsible for this batch.
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    /**
     * Get the sensor readings during this batch.
     */
    public function sensorReadings(): HasMany
    {
        return $this->hasMany(SensorReading::class, 'batch_id');
    }
}
