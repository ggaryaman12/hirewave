'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Icosahedron, Octahedron, Torus } from '@react-three/drei';
import * as THREE from 'three';

// Real WebGL hero centerpiece: a slowly-rotating crystalline core with an
// orbiting wire-torus and floating accent solids. Reacts to the pointer and to
// scroll. Intentionally geometric + brand-colored (not a generic particle
// "neural net"). SSR-disabled via the dynamic import in the consumer.

const VIOLET = '#8b5cf6';
const CYAN = '#22d3ee';
const FUCHSIA = '#d946ef';

function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useFrame(({ pointer: p }) => {
    pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, p.x, 0.05);
    pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, p.y, 0.05);
  });
  return pointer;
}

function Core({ scroll }: { scroll: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const pointer = usePointer();

  useFrame((_, delta) => {
    if (!group.current || !core.current) return;
    const s = scroll.current;
    // Pointer parallax + scroll-driven tilt.
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.current.x * 0.6 + s * Math.PI * 1.2, 0.06);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pointer.current.y * 0.4 + s * 0.6, 0.06);
    core.current.rotation.x += delta * 0.15;
    core.current.rotation.z += delta * 0.1;
    const scale = 1 + s * 0.25;
    group.current.scale.setScalar(scale);
  });

  return (
    <group ref={group}>
      {/* Solid faceted core */}
      <Icosahedron ref={core} args={[1.25, 0]}>
        <meshStandardMaterial
          color={VIOLET}
          metalness={0.6}
          roughness={0.25}
          emissive={VIOLET}
          emissiveIntensity={0.18}
          flatShading
        />
      </Icosahedron>
      {/* Wireframe shell */}
      <Icosahedron args={[1.55, 1]}>
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.25} />
      </Icosahedron>
      {/* Orbiting ring */}
      <Torus args={[2.3, 0.012, 16, 120]} rotation={[Math.PI / 2.4, 0, 0]}>
        <meshBasicMaterial color={FUCHSIA} transparent opacity={0.5} />
      </Torus>

      {/* Floating accent solids */}
      <Float speed={2} rotationIntensity={1.5} floatIntensity={1.5}>
        <Octahedron args={[0.28]} position={[2.6, 1.1, -0.5]}>
          <meshStandardMaterial color={CYAN} metalness={0.5} roughness={0.3} flatShading />
        </Octahedron>
      </Float>
      <Float speed={1.5} rotationIntensity={2} floatIntensity={2}>
        <Octahedron args={[0.2]} position={[-2.7, -0.9, 0.4]}>
          <meshStandardMaterial color={FUCHSIA} metalness={0.5} roughness={0.3} flatShading />
        </Octahedron>
      </Float>
      <Float speed={2.5} rotationIntensity={1} floatIntensity={1}>
        <Icosahedron args={[0.16, 0]} position={[1.9, -1.4, 0.8]}>
          <meshStandardMaterial color={VIOLET} metalness={0.4} roughness={0.4} flatShading />
        </Icosahedron>
      </Float>
    </group>
  );
}

function ScrollTracker({ scroll }: { scroll: React.MutableRefObject<number> }) {
  // Best-effort scroll progress 0..1 over the first viewport (works with Lenis,
  // which keeps window.scrollY in sync).
  useFrame(() => {
    if (typeof window === 'undefined') return;
    const max = window.innerHeight || 1;
    scroll.current = Math.min(1, Math.max(0, window.scrollY / max));
  });
  return null;
}

export default function ThreeHero() {
  const scroll = useRef(0);
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-5, -3, 2]} intensity={40} color={CYAN} />
      <pointLight position={[5, 3, -2]} intensity={30} color={FUCHSIA} />
      <Suspense fallback={null}>
        <ScrollTracker scroll={scroll} />
        <Core scroll={scroll} />
      </Suspense>
    </Canvas>
  );
}
