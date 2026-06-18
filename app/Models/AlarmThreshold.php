<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'machine_id',
    'temp_warning',
    'temp_critical',
    'pressure_warning',
    'pressure_critical',
    'heartbeat_timeout',
    'is_active',
])]
class AlarmThreshold extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'temp_warning' => 'decimal:2',
            'temp_critical' => 'decimal:2',
            'pressure_warning' => 'decimal:3',
            'pressure_critical' => 'decimal:3',
            'heartbeat_timeout' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the machine associated with this threshold.
     */
    public function machine(): BelongsTo
    {
        return $this->belongsTo(RetortMachine::class, 'machine_id');
    }
}
