<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\RetortMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index()
    {
        $this->authorizeAdmin();

        $users = User::with('machine')->paginate(10)->through(function ($user) {
            return [
                'id'           => $user->id,
                'name'         => $user->name,
                'email'        => $user->email,
                'role'         => $user->role,
                'machine_name' => $user->machine ? $user->machine->name : '-',
                'created_at'   => $user->created_at->format('Y-m-d H:i'),
            ];
        });

        return Inertia::render('Admin/Users/Index', [
            'users' => $users
        ]);
    }

    public function create()
    {
        $this->authorizeAdmin();

        return Inertia::render('Admin/Users/Create');
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin();

        $validated = $request->validate([
            'name'         => ['required', 'string', 'max:255'],
            'email'        => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'role'         => ['required', 'string', 'in:admin,operator'],
            'machine_code' => ['nullable', 'string', 'max:50'],
            'password'     => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $machineId = null;
        if ($validated['role'] === 'operator' && !empty($validated['machine_code'])) {
            $machine = RetortMachine::firstOrCreate(
                ['machine_code' => strtoupper(trim($validated['machine_code']))],
                [
                    'name'     => 'Mesin ' . strtoupper(trim($validated['machine_code'])),
                    'location' => '-',
                    'status'   => 'offline',
                ]
            );
            $machineId = $machine->id;
        }

        User::create([
            'name'       => $validated['name'],
            'email'      => $validated['email'],
            'role'       => $validated['role'],
            'machine_id' => $machineId,
            'password'   => Hash::make($validated['password']),
        ]);

        return redirect()->route('users')->with('success', 'Pengguna berhasil ditambahkan.');
    }

    public function edit(User $user)
    {
        $this->authorizeAdmin();

        return Inertia::render('Admin/Users/Edit', [
            'user' => [
                'id'           => $user->id,
                'name'         => $user->name,
                'email'        => $user->email,
                'role'         => $user->role,
                'machine_code' => $user->machine ? $user->machine->machine_code : '',
            ],
        ]);
    }

    public function update(Request $request, User $user)
    {
        $this->authorizeAdmin();

        $rules = [
            'name'         => ['required', 'string', 'max:255'],
            'email'        => ['required', 'string', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'role'         => ['required', 'string', 'in:admin,operator'],
            'machine_code' => ['nullable', 'string', 'max:50'],
        ];

        if ($request->filled('password')) {
            $rules['password'] = ['required', 'confirmed', Rules\Password::defaults()];
        }

        $validated = $request->validate($rules);

        $machineId = null;
        if ($validated['role'] === 'operator' && !empty($validated['machine_code'])) {
            $machine = RetortMachine::firstOrCreate(
                ['machine_code' => strtoupper(trim($validated['machine_code']))],
                [
                    'name'     => 'Mesin ' . strtoupper(trim($validated['machine_code'])),
                    'location' => '-',
                    'status'   => 'offline',
                ]
            );
            $machineId = $machine->id;
        }

        $user->name       = $validated['name'];
        $user->email      = $validated['email'];
        $user->role       = $validated['role'];
        $user->machine_id = $machineId;

        if ($request->filled('password')) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return redirect()->route('users')->with('success', 'Pengguna berhasil diperbarui.');
    }

    public function destroy(User $user)
    {
        $this->authorizeAdmin();

        if ($user->id === auth()->id()) {
            return back()->with('error', 'Anda tidak dapat menghapus akun sendiri.');
        }

        $user->delete();

        return back()->with('success', 'Pengguna berhasil dihapus.');
    }

    private function authorizeAdmin()
    {
        if (!auth()->user()->isAdmin()) {
            abort(403, 'Hanya admin yang dapat melakukan aksi ini.');
        }
    }
}
