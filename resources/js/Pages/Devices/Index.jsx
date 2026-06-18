import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Cpu, Plus, Settings } from 'lucide-react';

export default function DeviceIndex({ devices }) {
    return (
        <AuthenticatedLayout header="Perangkat">
            <Head title="Perangkat" />

            <div className="space-y-6">

                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium text-white">Daftar Mesin Retort</h2>
                    <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors">
                        <Plus className="w-4 h-4" /> Tambah Perangkat
                    </button>
                </div>

                {/* Device Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {devices.data.length > 0 ? (
                        devices.data.map((device) => (
                            <div key={device.id} className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg relative group transition-all hover:-translate-y-1 hover:shadow-indigo-500/10 hover:shadow-2xl hover:border-indigo-500/30">

                                <div className="absolute top-4 right-4 flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        {device.is_online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                        <span className={`relative inline-flex rounded-full h-3 w-3 ${device.is_online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        <Cpu className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{device.name}</h3>
                                        <p className="text-sm font-medium text-slate-400 font-mono mt-1">{device.mac_address}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Status Operasi</span>
                                        <span className={`font-medium px-2 py-1 rounded text-xs ${device.status === 'Running' ? 'bg-green-500/20 text-green-400' : (device.status === 'Standby' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400')}`}>
                                            {device.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Koneksi Terakhir</span>
                                        <span className="text-white font-medium">{device.last_heartbeat}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Tanggal Daftar</span>
                                        <span className="text-white font-medium">{device.created_at}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 flex justify-end">
                                    <button className="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2 text-sm font-medium">
                                        <Settings className="w-4 h-4" /> Konfigurasi
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center border border-dashed border-white/20 rounded-2xl">
                            <Cpu className="mx-auto h-12 w-12 text-slate-500 mb-3" />
                            <h3 className="text-lg font-medium text-white mb-1">Belum Ada Perangkat</h3>
                            <p className="text-slate-400 text-sm">Tambahkan perangkat ESP32 baru untuk memulai monitoring.</p>
                        </div>
                    )}
                </div>

            </div>
        </AuthenticatedLayout>
    );
}
