import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Cpu, Plus, Settings, Wifi, WifiOff, Activity, Calendar } from 'lucide-react';

export default function DeviceIndex({ devices }) {
    return (
        <AuthenticatedLayout header="Perangkat">
            <Head title="Perangkat" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Kelola perangkat ESP32 untuk monitoring retort</p>
                    </div>
                    <button className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Tambah Perangkat
                    </button>
                </div>

                {/* Device Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.data.length > 0 ? (
                        devices.data.map((device) => (
                            <div key={device.id} className="card-hover overflow-hidden group">
                                {/* Card Header */}
                                <div className="p-5 border-b border-gray-100">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFB800] to-[#FFC933] flex items-center justify-center shadow-lg shadow-[#FFB800]/20">
                                                <Cpu className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800">{device.name}</h3>
                                                <p className="text-xs font-mono text-gray-400 mt-0.5">{device.mac_address}</p>
                                            </div>
                                        </div>

                                        {/* Status Indicator */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="relative flex h-2.5 w-2.5">
                                                {device.is_online && (
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                )}
                                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                    device.is_online ? 'bg-green-500' : 'bg-red-500'
                                                }`}></span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <Activity className="w-4 h-4" />
                                            Status Operasi
                                        </span>
                                        <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                                            device.status === 'Running'
                                                ? 'bg-green-100 text-green-700'
                                                : device.status === 'Standby'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {device.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            {device.is_online ? (
                                                <Wifi className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <WifiOff className="w-4 h-4 text-red-500" />
                                            )}
                                            Koneksi
                                        </span>
                                        <span className={`font-medium ${device.is_online ? 'text-green-600' : 'text-red-600'}`}>
                                            {device.is_online ? 'Online' : 'Offline'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Terakhir Aktif
                                        </span>
                                        <span className="font-medium text-gray-700">{device.last_heartbeat}</span>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button className="btn btn-outline btn-sm">
                                        <Settings className="w-4 h-4" />
                                        Konfigurasi
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full">
                            <div className="card p-12 text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                    <Cpu className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum Ada Perangkat</h3>
                                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                                    Tambahkan perangkat ESP32 baru untuk memulai monitoring suhu retort secara real-time.
                                </p>
                                <button className="btn btn-primary">
                                    <Plus className="w-4 h-4" />
                                    Tambah Perangkat Pertama
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
