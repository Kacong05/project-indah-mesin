import { useRef, useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns emissive colour based on temperature. */
function getEmissiveColor(temperature) {
  if (temperature > 121) return new THREE.Color('#ff1111'); // bright red
  if (temperature > 115) return new THREE.Color('#cc0000'); // red
  if (temperature >= 100) return new THREE.Color('#ff6600'); // orange
  return new THREE.Color('#003311');                          // dark green tint (cool)
}

/** Returns base body colour based on temperature. */
function getBodyColor(temperature) {
  if (temperature > 121) return new THREE.Color('#ff3333');
  if (temperature > 115) return new THREE.Color('#dd2200');
  if (temperature >= 100) return new THREE.Color('#cc5500');
  return new THREE.Color('#c0c8d0'); // stainless steel
}

// ─── Steam Particles ─────────────────────────────────────────────────────────

function SteamParticles({ temperature }) {
  const count = Math.max(10, Math.floor((temperature / 130) * 100));
  const pointsRef = useRef();

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 1] = Math.random() * 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      vel[i * 3]     = (Math.random() - 0.5) * 0.001;
      vel[i * 3 + 1] = 0.003 + Math.random() * 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
    }
    return { positions: pos, velocities: vel };
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      attr.array[i * 3]     += velocities[i * 3];
      attr.array[i * 3 + 1] += velocities[i * 3 + 1];
      attr.array[i * 3 + 2] += velocities[i * 3 + 2];
      if (attr.array[i * 3 + 1] > 1.5) {
        attr.array[i * 3]     = (Math.random() - 0.5) * 0.6;
        attr.array[i * 3 + 1] = 0;
        attr.array[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      }
    }
    attr.needsUpdate = true;
  });

  const intensity = Math.min(temperature / 130, 1);

  return (
    // Place steam at top of model bounding box (max Y ≈ 0.285 → world Y ≈ 0.29)
    <points ref={pointsRef} geometry={geometry} position={[0, 0.29, -0.3]}>
      <pointsMaterial
        color="#b0d8f0"
        size={0.025}
        transparent
        opacity={0.15 + intensity * 0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ─── Indicator Light ──────────────────────────────────────────────────────────

function IndicatorLight({ status }) {
  const meshRef = useRef();
  const color = status === 'running' ? '#00ff66'
              : status === 'error'   ? '#ff2222'
              : '#ffcc00';

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (status === 'error') {
      meshRef.current.material.opacity =
        Math.sin(clock.getElapsedTime() * 10) > 0 ? 1 : 0.05;
    } else {
      meshRef.current.material.opacity = 1;
    }
  });

  // Placed relative to model center: front-right, near top
  return (
    <mesh ref={meshRef} position={[0.3, 0.2, 0.02]}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={3}
        transparent
      />
    </mesh>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * RetortModel — loads /public/models/retort.glb and applies dynamic effects.
 *
 * GLB facts (parsed from binary):
 *   - 1 node ("node_0"), 1 mesh, 922 622 vertices
 *   - Bounding box: X[−0.434, 0.483]  Y[−0.295, 0.285]  Z[−0.593, 0.000]
 *   - Center: (0.024, −0.005, −0.296)
 *   - Max dimension: ~0.917 (X axis)
 *
 * We offset position by (−0.024, 0.005, 0.296) to re-centre the model,
 * then scale to ~2.5 to make it nicely visible in the viewport.
 */
export default function RetortModel({ temperature, processStatus }) {
  const { scene } = useGLTF('/models/retort.glb');
  const meshesRef = useRef([]);
  const isRunning = processStatus === 'running';

  // One-time material setup after scene loads
  useEffect(() => {
    const meshes = [];
    scene.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;
      // Clone material so mutations don't affect the cached scene
      child.material = new THREE.MeshStandardMaterial({
        color:             getBodyColor(temperature),
        metalness:         0.88,
        roughness:         0.22,
        envMapIntensity:   1.0,
        emissive:          getEmissiveColor(temperature),
        emissiveIntensity: 0,
      });
      meshes.push(child);
    });
    meshesRef.current = meshes;
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-frame: update colour + emissive + pulse
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const emissive  = getEmissiveColor(temperature);
    const bodyColor = getBodyColor(temperature);

    meshesRef.current.forEach((mesh) => {
      if (!mesh.material) return;
      mesh.material.color.copy(bodyColor);
      mesh.material.emissive.copy(emissive);

      if (isRunning) {
        // Pulse between 0.1 and 0.4
        mesh.material.emissiveIntensity = 0.25 + Math.sin(t * 3) * 0.15;
      } else if (temperature >= 100) {
        mesh.material.emissiveIntensity = 0.15;
      } else {
        mesh.material.emissiveIntensity = 0;
      }
    });
  });

  // GLB bounding box center: (0.024, −0.005, −0.296)
  // Negate to re-center model at world origin, then scale up.
  const SCALE = 2.5;
  const OFFSET_X = -0.024 * SCALE;
  const OFFSET_Y = 0.005 * SCALE;
  const OFFSET_Z = 0.296 * SCALE;

  return (
    <group position={[OFFSET_X, OFFSET_Y, OFFSET_Z]} scale={SCALE}>
      <primitive object={scene} />
      <SteamParticles temperature={temperature} />
      <IndicatorLight status={processStatus} />
    </group>
  );
}

useGLTF.preload('/models/retort.glb');
