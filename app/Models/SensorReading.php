<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'machine_id',
    'batch_id',
    'temperature',
    'pressure',
    'process_status',
    'recorded_at',
])]
class SensorReading extends Model
{
    /**
     * Indicates if the model should be timestamped.
     * Only `created_at` is used, no `updated_at`.
     */
    public const UPDATED_AT = null;

    /**
     * Process status constants.
     */
    public const STATUS_IDLE = 'idle';
    public const STATUS_HEATING = 'heating';
    public const STATUS_STERILIZING = 'sterilizing';
    public const STATUS_COOLING = 'cooling';
    public const STATUS_COMPLETED = 'completed';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'temperature' => 'decimal:2',
            'pressure' => 'decimal:3',
            'recorded_at' => 'datetime',
        ];
    }

    /**
     * Get the machine that generated this reading.
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(RetortMachine::class, 'machine_id');
    }

    /**
     * Get the production batch associated with this reading.
     */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductionBatch::class, 'batch_id');
    }
}
