import { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import RetortModel from '../Components/RetortModel';
import StatusPanel from '../Components/StatusPanel';
import { fetchLatestSensor } from '../services/api';

/**
 * RetortMonitor – main dashboard entry point.
 *
 * Security notes:
 * - All API data is validated/sanitised in services/api.js.
 * - React JSX auto-escaping applies everywhere; no dangerouslySetInnerHTML.
 * - TODO(security): In production, serve over HTTPS and proxy API via BFF layer.
 * - TODO(security): Add operator auth controls in production.
 */

/** Loading indicator rendered inside the Canvas via Html helper. */
function ModelLoader() {
  return (
    <Html center>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        color: '#94a3b8', fontFamily: 'sans-serif', fontSize: 13,
        background: 'rgba(13,17,23,0.85)', padding: '16px 24px',
        borderRadius: 10, border: '1px solid #334155', whiteSpace: 'nowrap'
      }}>
        <div style={{
          width: 28, height: 28,
          border: '3px solid #334155',
          borderTop: '3px solid #22d3ee',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span>Loading 3D model…</span>
      </div>
    </Html>
  );
}

export default function RetortMonitor() {
  const [sensorData, setSensorData] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const data = await fetchLatestSensor();
      if (!mounted) return;
      if (data) {
        setSensorData(data);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const temp   = sensorData?.temperature    ?? 0;
  const status = sensorData?.process_status ?? 'standby';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0d1117', color: '#f1f5f9', fontFamily: 'sans-serif' }}>

      {/* ── Left: 3D Viewport ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>

        {/* Corner label */}
        <div style={{ position: 'absolute', top: 14, left: 16, zIndex: 10, fontSize: 10, color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
          3D View · RT-Monitor
        </div>

        {/* Canvas must fill its parent – explicit width/height is critical */}
        <Canvas
          shadows
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{ position: [0, 1, 3.5], fov: 50, near: 0.01, far: 500 }}
          gl={{ antialias: true }}
        >
          {/* ── Lights ── */}
          <ambientLight intensity={0.5} />
          <directionalLight
            castShadow
            position={[4, 6, 4]}
            intensity={2}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-3, 3, -3]} intensity={0.8} color="#4488ff" />
          <pointLight position={[3, -1, 3]}  intensity={0.4} color="#ff8844" />

          {/* ── Environment for metallic reflections ── */}
          <Environment preset="warehouse" />

          {/* ── Floor grid ── */}
          <Grid
            receiveShadow
            position={[0, -0.75, 0]}
            args={[10, 10]}
            cellSize={0.25}
            cellThickness={0.5}
            cellColor="#1e293b"
            sectionSize={1}
            sectionThickness={1}
            sectionColor="#334155"
            fadeDistance={8}
            fadeStrength={1}
            infiniteGrid
          />

          {/* ── 3D Model (inside Suspense for async GLB load) ── */}
          <Suspense fallback={<ModelLoader />}>
            <RetortModel temperature={temp} processStatus={status} />
          </Suspense>

          {/* ── Orbit Controls ── */}
          <OrbitControls
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.07}
            minDistance={1}
            maxDistance={15}
            enablePan
          />
        </Canvas>

        {/* Gradient overlays */}
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,17,23,0.55) 0%, transparent 35%)' }} />
        <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 70%, rgba(13,17,23,0.3) 100%)' }} />
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, background: '#1e293b', flexShrink: 0 }} />

      {/* ── Right: Status Panel ── */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#111827', borderLeft: '1px solid #1e293b' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>Retort Monitor</h1>
            <p style={{ margin: 0, fontSize: 10, color: '#64748b', marginTop: 3 }}>Indah Mesin · Industrial Dashboard</p>
          </div>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          <StatusPanel data={sensorData} error={fetchError} />
        </div>
      </div>
    </div>
  );
}
