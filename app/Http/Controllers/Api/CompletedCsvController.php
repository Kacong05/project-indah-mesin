<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RetortMachine;
use App\Services\CompletedCsvImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompletedCsvController extends Controller
{
    public function store(Request $request, CompletedCsvImportService $importer): JsonResponse
    {
        $validated = $request->validate([
            'machine_code' => 'required|string|exists:retort_machines,machine_code',
            'file' => 'required|file|mimes:csv,txt|max:10240',
            'sha256' => 'nullable|string|size:64',
        ]);

        $machine = RetortMachine::where('machine_code', $validated['machine_code'])->firstOrFail();
        $result = $importer->import($machine, $request->file('file'), $validated['sha256'] ?? null);

        return response()->json([
            'success' => true,
            'imported' => ! $result['duplicate'],
            'duplicate' => $result['duplicate'],
            'session_id' => $result['session']->id,
            'data_count' => $result['session']->data_count,
        ]);
    }
}
