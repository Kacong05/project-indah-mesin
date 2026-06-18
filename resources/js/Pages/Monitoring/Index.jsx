import { useEffect, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { Activity, Server, Wifi, Clock, Thermometer } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function MonitoringRealtime({ temperature, isOnline, serverStatus, lastReadingTime, machineName }) {
    
    // Auto refresh every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['temperature', 'isOnline', 'lastReadingTime'] });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Gauge Chart Data
    const maxTemp = 150;
    const currentTemp = parseFloat(temperature) || 0;
    const remainingTemp = maxTemp - currentTemp > 0 ? maxTemp - currentTemp : 0;
    
    // Determine color based on temperature (Normal: < 110, Warning: 110-120, Critical: > 120)
    let tempColor = 'rgba(59, 130, 246, 1)'; // Blue
    if (currentTemp >= 120) tempColor = 'rgba(239, 68, 68, 1)'; // Red
    else if (currentTemp >= 110) tempColor = 'rgba(245, 158, 11, 1)'; // Orange

    const gaugeData = {
        datasets: [
            {
                data: [currentTemp, remainingTemp],
                backgroundColor: [tempColor, 'rgba(255, 255, 255, 0.05)'],
                borderColor: ['transparent', 'transparent'],
                circumference: 270,
                rotation: 225,
                cutout: '80%',
                borderRadius: 5,
            }
        ]
    };

    return (
        <AuthenticatedLayout header={`Monitoring Realtime - ${machineName}`}>
            <Head title="Monitoring Realtime" />

            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Main Gauge Area */}
                <div className="flex-1 overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-2xl flex flex-col items-center justify-center relative min-h-[500px]">
                    <h2 className="text-xl font-medium text-slate-300 absolute top-8">Suhu Saat Ini</h2>
                    
                    <div className="relative w-80 h-80 flex items-center justify-center">
                        <Doughnut 
                            data={gaugeData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: true, 
                                plugins: { tooltip: { enabled: false } },
                                animation: { animateRotate: false, animateScale: false }
                            }} 
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-10">
                            <span className="text-6xl font-bold text-white tracking-tighter drop-shadow-md">
                                {currentTemp.toFixed(1)}
                            </span>
                            <span className="text-xl text-slate-400 font-medium">°C</span>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                        <Activity className="w-5 h-5 animate-pulse" />
                        <span className="text-sm font-medium tracking-wider uppercase">Live Monitoring Active</span>
                    </div>
                </div>

                {/* Status Sidebar */}
                <div className="w-full lg:w-96 space-y-4">
                    
                    {/* Device Status */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <h3 className="text-sm font-medium text-slate-400 mb-4">Status Koneksi ESP32</h3>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <Wifi className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-lg">{isOnline ? 'Online' : 'Offline'}</p>
                                    <p className="text-sm text-slate-400">NodeMCU / ESP32</p>
                                </div>
                            </div>
                            <div className="flex items-center h-full">
                                <span className="relative flex h-3 w-3">
                                  {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Server Status */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <h3 className="text-sm font-medium text-slate-400 mb-4">Status Server</h3>
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
                                <Server className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-lg">{serverStatus}</p>
                                <p className="text-sm text-slate-400">Main Database</p>
                            </div>
                        </div>
                    </div>

                    {/* Last Reading Time */}
                    <div className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-lg">
                        <h3 className="text-sm font-medium text-slate-400 mb-4">Pembacaan Terakhir</h3>
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-md">{lastReadingTime}</p>
                                <p className="text-sm text-slate-400">Timestamp</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
