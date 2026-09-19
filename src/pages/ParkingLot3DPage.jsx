import React, { useState, useMemo, useRef, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useSystemState } from '../hooks/useSystemState';
import {
  PARKING_SPACES,
  getStatusConfig,
  getCarVariant
} from '../data/parkingLotConfig';
import { formatDistance, formatPercent, formatPower } from '../utils/formatters';
import {
  Car, Zap, Battery, Clock, ArrowLeft,
  RefreshCw, Maximize2, Grid3X3, Layers3,
  Sun, Activity, AlertTriangle, CheckCircle2,
  PauseCircle, Eye, Sparkles, ShieldAlert,
  Flame, ChevronRight, X, Gauge, Building2,
  HelpCircle, Compass
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FILTER_OPTIONS = ['All', 'Charging', 'Paused', 'Waiting', 'Completed', 'Empty'];

const DEMO_SCENARIOS = [
  { name: 'NORMAL', label: 'Normal', icon: CheckCircle2, color: '#16a34a' },
  { name: 'EV_RUSH', label: 'EV Rush', icon: Car, color: '#2563eb' },
  { name: 'BUILDING_PEAK', label: 'Grid Stress', icon: Flame, color: '#dc2626' },
  { name: 'SOLAR_SURGE', label: 'Solar Peak', icon: Sun, color: '#d97706' },
  { name: 'CHARGER_FAULT', label: 'Charger Fault', icon: ShieldAlert, color: '#991b1b' },
];

// Rich curated automotive metallic palettes
const CAR_COLORS = [
  '#f8fafc', // Pearl White
  '#0f3e2e', // Forest Emerald
  '#1e3a8a', // Royal Sapphire
  '#64748b', // Slate Metallic
  '#991b1b', // Crimson Sport
  '#18181b', // Obsidian Matte
  '#d97706', // Solar Gold
  '#334155', // Graphite
];

function getCarColor(evId) {
  if (!evId) return '#64748b';
  const hash = evId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CAR_COLORS[hash % CAR_COLORS.length];
}

// ─── 3D PROCEDURAL ASSETS & ENVIRONMENT ──────────────────────────────────────

/** Modern architectural streetlamp light mast casting downlight */
function LightMast({ x, z, rotation = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      {/* Base Mount Flange with Anchor Bolts */}
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.16, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Heavy Galvanized Steel Pole */}
      <mesh castShadow position={[0, 2.7, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 5.4, 12]} />
        <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Cantilever Luminaire Arm */}
      <mesh position={[0.45, 5.35, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.9, 0.08, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      {/* LED Floodlight Head Fixture */}
      <mesh position={[0.9, 5.25, 0]}>
        <boxGeometry args={[0.35, 0.08, 0.25]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} />
      </mesh>
      {/* Glowing Warm LED Luminaire Panel */}
      <mesh position={[0.9, 5.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={2.4} />
      </mesh>
    </group>
  );
}

/** Realistic Plaza Entrance Area with Signage & Security Boom Barrier */
function ParkingEntrance({ x = -17.5, z = 0 }) {
  return (
    <group position={[x, 0, z]}>
      {/* Entrance Gateway Security Pillar */}
      <mesh position={[0, 0.55, -2.6]} castShadow>
        <boxGeometry args={[0.4, 1.1, 0.4]} />
        <meshStandardMaterial color="#ea580c" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Security Boom Barrier Arm with Safety Stripes */}
      <group position={[0.1, 0.9, -0.3]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.08, 4.2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {[-1.6, -0.8, 0, 0.8, 1.6].map((sz) => (
          <mesh key={sz} position={[0.002, 0, sz]}>
            <boxGeometry args={[0.084, 0.084, 0.35]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        ))}
      </group>

      {/* Modern Digital Totem Signage */}
      <group position={[0, 1.8, -4.2]}>
        {/* Monolith Pillar */}
        <mesh castShadow>
          <boxGeometry args={[0.35, 3.6, 1.3]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Brand Plaque */}
        <mesh position={[0.18, 1.1, 0]}>
          <planeGeometry args={[1.1, 0.4]} />
          <meshStandardMaterial color="#14532d" emissive="#16a34a" emissiveIntensity={1.4} />
        </mesh>
        <Text
          position={[0.19, 1.1, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight={900}
        >
          VOLTFLOW PLAZA
        </Text>
        <Text
          position={[0.19, 0.6, 0]}
          fontSize={0.09}
          color="#86efac"
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          SMART EV CHARGING
        </Text>
      </group>
    </group>
  );
}

/** Clean modern asphalt ground with marked driving lanes, curbs, streetlamps, and landscaping */
function ModernParkingGround() {
  return (
    <group>
      {/* Surrounding Grass Landscaping */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[60, 48]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Main Asphalt Parking Lot Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[36, 26]} />
        <meshStandardMaterial color="#1e293b" roughness={0.88} metalness={0.12} />
      </mesh>

      {/* Concrete Curb Perimeter with Chamfer */}
      <mesh position={[0, 0.06, -13]} receiveShadow castShadow>
        <boxGeometry args={[36.2, 0.14, 0.45]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, 13]} receiveShadow castShadow>
        <boxGeometry args={[36.2, 0.14, 0.45]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      <mesh position={[-18, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.45, 0.14, 26]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      <mesh position={[18, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.45, 0.14, 26]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>

      {/* Driveway Central Lines & Directional Arrows */}
      {[-3.75, 4.25].map((z, idx) => (
        <group key={idx} position={[0, 0.002, z]}>
          {/* Dashed white center lane divider */}
          {[-12, -8, -4, 0, 4, 8, 12].map((lx) => (
            <mesh key={lx} position={[lx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.2, 0.12]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
          ))}
          {/* Directional Arrows painted on asphalt */}
          {[-7, 1, 9].map((x) => (
            <group key={x} position={[x, 0.003, 0]} rotation={[-Math.PI / 2, 0, idx === 0 ? 0 : Math.PI]}>
              {/* Arrow stem */}
              <mesh position={[0, -0.3, 0]}>
                <planeGeometry args={[0.12, 0.5]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.4} />
              </mesh>
              {/* Arrow head */}
              <mesh position={[0, 0.1, 0]}>
                <coneGeometry args={[0.26, 0.5, 3]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Pedestrian Crosswalk Stripes at Entrance */}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((z) => (
        <mesh key={z} position={[-15.2, 0.003, z * 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, 1.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}

      {/* Modern High-Mast Streetlamps at perimeter corners */}
      <LightMast x={-16} z={-11.5} rotation={0.4} />
      <LightMast x={16}  z={-11.5} rotation={-0.4} />
      <LightMast x={-16} z={11.5}  rotation={Math.PI - 0.4} />
      <LightMast x={16}  z={11.5}  rotation={Math.PI + 0.4} />

      {/* Entrance Gateway Infrastructure */}
      <ParkingEntrance x={-17} z={0} />

      {/* Concrete Landscaping Planters along North/South Borders */}
      {[-10, 0, 10].map((px) => (
        <group key={px} position={[px, 0, 12.1]}>
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[3.2, 0.3, 0.6]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[3.0, 0.18, 0.45]} />
            <meshStandardMaterial color="#15803d" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Individual Parking Slot marking lines, stopper blocks, and EV stencils on asphalt */
function ParkingBayMarking({ x, z, rotation, isOccupied, spaceId }) {
  const lineColor = isOccupied ? '#94a3b8' : '#e2e8f0';
  return (
    <group position={[x, 0.002, z]} rotation={[0, rotation, 0]}>
      {/* Left Bay Line */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.004, 2.5]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Right Bay Line */}
      <mesh position={[1.9, 0, 0]}>
        <boxGeometry args={[0.08, 0.004, 2.5]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Back Line */}
      <mesh position={[0.95, 0, -1.25]}>
        <boxGeometry args={[1.98, 0.004, 0.08]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* End Curb/Stopper Block with Safety Hazard Stripes */}
      <mesh position={[0.95, 0.06, -1.1]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.12, 0.16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      {/* Yellow Safety Chevrons on Stopper Block */}
      {[-0.45, 0, 0.45].map((sx) => (
        <mesh key={sx} position={[0.95 + sx, 0.065, -1.018]}>
          <planeGeometry args={[0.18, 0.08]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
      ))}

      {/* Painted Green EV Charging Stencil on Asphalt */}
      <group position={[0.95, 0.003, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial color="#16a34a" transparent opacity={0.25} />
      </group>
    </group>
  );
}

/** Sleek Commercial Level 2 / DC Fast EV Charger Kiosk */
function ChargerKiosk({ x, z, status, isCharging, chargerId = 'CH-01' }) {
  const ringRef = useRef();
  const color = isCharging ? '#16a34a' : (status === 'offline' ? '#dc2626' : status === 'waiting' ? '#2563eb' : '#64748b');

  useFrame((_, delta) => {
    if (ringRef.current && isCharging) {
      ringRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Base Pedestal with Anchor Flange */}
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.16, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Main Kiosk Body Tower */}
      <mesh castShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[0.24, 1.05, 0.18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Brushed Metal Side Trim */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.245, 0.98, 0.02]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Front High-Res Digital Display Screen */}
      <mesh position={[0, 0.78, 0.095]}>
        <planeGeometry args={[0.18, 0.26]} />
        <meshStandardMaterial
          color={isCharging ? '#022c22' : '#090d16'}
          emissive={isCharging ? '#10b981' : '#38bdf8'}
          emissiveIntensity={isCharging ? 0.9 : 0.25}
          roughness={0.1}
        />
      </mesh>
      {/* Top Status LED Ring / Beacon */}
      <mesh position={[0, 1.16, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.07, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isCharging ? 2.0 : 0.5}
        />
      </mesh>
      {/* Active Charging Holographic Aura */}
      {isCharging && (
        <mesh ref={ringRef} position={[0, 1.3, 0]}>
          <torusGeometry args={[0.15, 0.02, 12, 24]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={2.8}
            transparent
            opacity={0.88}
          />
        </mesh>
      )}
      {/* Holstered Cable Coil on Side */}
      <mesh position={[0.14, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.08, 0.025, 8, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** 3D Quadratic Bezier Charging Cable */
function ChargingCable({ startX, startZ, endX, endZ, active }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(startX, 0.5, startZ);
    const mid   = new THREE.Vector3((startX + endX) / 2, 0.2, (startZ + endZ) / 2);
    const end   = new THREE.Vector3(endX, 0.4, endZ);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(18);
  }, [startX, startZ, endX, endZ]);

  const curveObject = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 18, 0.022, 8, false);
  }, [points]);

  return (
    <mesh geometry={curveObject}>
      <meshStandardMaterial
        color={active ? '#16a34a' : '#475569'}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
}

/** Animated Energy Particles flowing along the charging cable */
function EnergyFlowParticles({ startX, startZ, endX, endZ }) {
  const p1Ref = useRef();
  const p2Ref = useRef();
  const t1 = useRef(0);
  const t2 = useRef(0.5);

  useFrame((_, delta) => {
    t1.current = (t1.current + delta * 0.9) % 1;
    t2.current = (t2.current + delta * 0.9) % 1;

    const calcPos = (t) => {
      const x = startX + (endX - startX) * t;
      const z = startZ + (endZ - startZ) * t;
      const y = 0.5 * (1 - t) + 0.4 * t - Math.sin(t * Math.PI) * 0.25;
      return [x, Math.max(0.1, y), z];
    };

    if (p1Ref.current) {
      const [x, y, z] = calcPos(t1.current);
      p1Ref.current.position.set(x, y, z);
    }
    if (p2Ref.current) {
      const [x, y, z] = calcPos(t2.current);
      p2Ref.current.position.set(x, y, z);
    }
  });

  return (
    <group>
      <mesh ref={p1Ref}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={3.0} />
      </mesh>
      <mesh ref={p2Ref}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={3.0} />
      </mesh>
    </group>
  );
}

/** High-Quality Procedural Vehicle Model with 4 distinct variations */
function ProceduralEV({ variant = 0, color = '#3b82f6', selected, hovered }) {
  // Body configurations per variant
  const VARIANTS = [
    // Variant 0: Modern Aerodynamic Sedan (e.g. Model 3 / Polestar)
    { bodyLength: 2.1, bodyWidth: 1.0, bodyHeight: 0.32, cabinLength: 1.25, cabinWidth: 0.88, cabinHeight: 0.28, cabinOffset: -0.05 },
    // Variant 1: Electric SUV / Crossover (e.g. Model Y / e-tron)
    { bodyLength: 2.15, bodyWidth: 1.08, bodyHeight: 0.38, cabinLength: 1.45, cabinWidth: 0.94, cabinHeight: 0.36, cabinOffset: -0.02 },
    // Variant 2: Compact Urban Hatchback (e.g. ID.3 / Leaf)
    { bodyLength: 1.85, bodyWidth: 0.98, bodyHeight: 0.34, cabinLength: 1.2, cabinWidth: 0.86, cabinHeight: 0.32, cabinOffset: -0.1 },
    // Variant 3: Performance Fastback / Cyber (e.g. Taycan)
    { bodyLength: 2.2, bodyWidth: 1.06, bodyHeight: 0.28, cabinLength: 1.35, cabinWidth: 0.9, cabinHeight: 0.25, cabinOffset: 0.05 },
  ];

  const cfg = VARIANTS[variant % VARIANTS.length];
  const paintColor = selected ? '#166534' : hovered ? '#15803d' : color;

  return (
    <group position={[0, 0.22, 0]}>
      {/* Soft Contact Shadow beneath vehicle */}
      <mesh position={[0, -0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cfg.bodyWidth * 1.35, cfg.bodyLength * 1.25]} />
        <meshBasicMaterial color="#050b14" transparent opacity={0.65} depthWrite={false} />
      </mesh>

      {/* Lower Main Car Chassis */}
      <mesh castShadow position={[0, cfg.bodyHeight / 2, 0]}>
        <boxGeometry args={[cfg.bodyWidth, cfg.bodyHeight, cfg.bodyLength]} />
        <meshStandardMaterial
          color={paintColor}
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>

      {/* Aerodynamic Cabin / Greenhouse */}
      <mesh castShadow position={[0, cfg.bodyHeight + cfg.cabinHeight / 2 - 0.02, cfg.cabinOffset]}>
        <boxGeometry args={[cfg.cabinWidth, cfg.cabinHeight, cfg.cabinLength]} />
        <meshStandardMaterial
          color={paintColor}
          roughness={0.25}
          metalness={0.65}
        />
      </mesh>

      {/* Glass Windshield (Front) */}
      <mesh position={[0, cfg.bodyHeight + cfg.cabinHeight * 0.45, cfg.cabinOffset + cfg.cabinLength / 2 + 0.01]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[cfg.cabinWidth * 0.92, cfg.cabinHeight * 0.95]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} transparent opacity={0.88} />
      </mesh>

      {/* Glass Rear Window */}
      <mesh position={[0, cfg.bodyHeight + cfg.cabinHeight * 0.45, cfg.cabinOffset - cfg.cabinLength / 2 - 0.01]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[cfg.cabinWidth * 0.92, cfg.cabinHeight * 0.95]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} transparent opacity={0.88} />
      </mesh>

      {/* 4 Rubber Tires with Alloy Rims */}
      {[
        [-cfg.bodyWidth / 2 - 0.03, 0.02, cfg.bodyLength * 0.32],
        [ cfg.bodyWidth / 2 + 0.03, 0.02, cfg.bodyLength * 0.32],
        [-cfg.bodyWidth / 2 - 0.03, 0.02, -cfg.bodyLength * 0.32],
        [ cfg.bodyWidth / 2 + 0.03, 0.02, -cfg.bodyLength * 0.32],
      ].map(([wx, wy, wz], i) => (
        <group key={i} position={[wx, wy, wz]}>
          {/* Black Rubber Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.12, 16]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
          </mesh>
          {/* Silver Alloy Hub / Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[wx > 0 ? 0.06 : -0.06, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.02, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Front LED Headlights */}
      <mesh position={[-cfg.bodyWidth * 0.34, cfg.bodyHeight * 0.65, cfg.bodyLength / 2 + 0.01]}>
        <boxGeometry args={[0.2, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[cfg.bodyWidth * 0.34, cfg.bodyHeight * 0.65, cfg.bodyLength / 2 + 0.01]}>
        <boxGeometry args={[0.2, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={1.8} />
      </mesh>

      {/* Rear Glowing Red Taillight Bar */}
      <mesh position={[0, cfg.bodyHeight * 0.75, -cfg.bodyLength / 2 - 0.01]}>
        <boxGeometry args={[cfg.bodyWidth * 0.88, 0.05, 0.02]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

/** Complete Parking Slot Assembly (Markings, Charger, Cable, Car, HUD) */
function ParkingSlotAssembly({
  space,
  ev,
  charger,
  selected,
  hovered,
  onSelect,
  onHover,
  filter
}) {
  const isOccupied   = !!ev;
  const isCharging   = ev?.status === 'Charging';
  const isPaused     = ev?.status === 'Paused';
  const isComplete   = ev?.status === 'Completed' || ev?.status === 'Target reached';
  const isFaulted    = ev?.status === 'Faulted';
  const statusCfg    = ev ? getStatusConfig(ev.status) : getStatusConfig('Empty');

  const variant  = ev ? getCarVariant(ev.id) : 0;
  const carColor = ev ? getCarColor(ev.id) : '#94a3b8';

  // Filter evaluation
  const isFiltered = filter !== 'All';
  const matchesFilter = !isFiltered || (
    filter === 'Charging'  ? isCharging :
    filter === 'Paused'    ? isPaused :
    filter === 'Waiting'   ? ev?.status === 'Waiting' :
    filter === 'Completed' ? isComplete :
    filter === 'Empty'     ? !ev : true
  );

  const dimmed = isFiltered && !matchesFilter;

  // Charger location: stationed on the walkway side of the bay
  const isFlipped = space.rotation === Math.PI;
  const chargerX = space.x - 0.85;
  const chargerZ = isFlipped ? space.z + 1.45 : space.z - 1.45;

  const carCenterX = space.x + 0.95;
  const carCenterZ = space.z;

  return (
    <group>
      {/* Bay Lines on Ground */}
      <ParkingBayMarking
        x={space.x}
        z={space.z}
        rotation={space.rotation}
        isOccupied={isOccupied}
      />

      {/* EV Charger Kiosk */}
      {charger && (
          <ChargerKiosk
          x={chargerX}
          z={chargerZ}
          status={charger.status}
            isCharging={isCharging && !isFaulted}
        />
      )}

      {/* Connected Charging Cable + Glowing Energy Particles */}
      {(isCharging || isPaused || isComplete) && ev && (
        <>
          <ChargingCable
            startX={chargerX}
            startZ={chargerZ}
            endX={carCenterX - 0.55}
            endZ={carCenterZ + (isFlipped ? 0.6 : -0.6)}
            active={isCharging}
          />
          {isCharging && (
            <EnergyFlowParticles
              startX={chargerX}
              startZ={chargerZ}
              endX={carCenterX - 0.55}
              endZ={carCenterZ + (isFlipped ? 0.6 : -0.6)}
            />
          )}
        </>
      )}

      {/* EV Vehicle Group */}
      {isOccupied && (
        <group
          position={[carCenterX, 0, carCenterZ]}
          rotation={[0, space.rotation, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect(space, ev, charger); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(space.id); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = 'default'; }}
        >
          <group opacity={dimmed ? 0.2 : 1}>
            <ProceduralEV
              variant={variant}
              color={carColor}
              selected={selected}
              hovered={hovered}
            />
          </group>

          {/* Floating Status Beacon */}
          <mesh position={[0, 1.15, 0]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial
              color={statusCfg.color}
              emissive={statusCfg.color}
              emissiveIntensity={isCharging ? 2.0 : 0.6}
            />
          </mesh>

          {/* Donezo Style Minimalist Floating HUD Badge */}
          {!dimmed && (
            <Html position={[0, 1.55, 0]} center distanceFactor={14} zIndexRange={[10, 20]}>
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(4px)',
                  border: `1.5px solid ${selected ? '#166534' : statusCfg.borderColor}`,
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: statusCfg.color,
                  boxShadow: `0 0 6px ${statusCfg.color}`
                }} />
                <span style={{ fontWeight: 800, fontSize: '10px', color: '#0f172a' }}>
                  {ev.id}
                </span>
                <span style={{ color: statusCfg.color, fontWeight: 700, fontSize: '10px' }}>
                  {isCharging ? `${formatPower(ev.allocatedPower)} kW` : statusCfg.label}
                </span>
                <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 600 }}>
                  {formatPercent(ev.currentSoc)}%
                </span>
              </div>
            </Html>
          )}
        </group>
      )}

      {/* Empty Slot Click Target */}
      {!isOccupied && (
        <mesh
          position={[carCenterX, 0.015, carCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect(space, null, charger); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(space.id); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = 'default'; }}
        >
          <planeGeometry args={[1.8, 2.3]} />
          <meshStandardMaterial
            color="#22c55e"
            transparent
            opacity={hovered ? 0.35 : 0.08}
          />
        </mesh>
      )}

      {/* Slot Identification Code on Asphalt */}
      <Text
        position={[carCenterX, 0.012, isFlipped ? space.z + 1.1 : space.z - 1.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        fontWeight={800}
      >
        {space.id}
      </Text>
    </group>
  );
}

/** High-Efficiency Solar Canopy covering Row A */
function SolarRooftopCanopy({ solarGeneration = 0 }) {
  const isSolarGenerating = solarGeneration > 2;
  return (
    <group position={[0, 0, -6]}>
      {/* Structural Steel Support Pillars */}
      {[-8.5, -4.5, -0.5, 3.5, 7.5].map((x) => (
        <mesh key={x} position={[x, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 2.8, 12]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}

      {/* Canopy Framework Beams */}
      <mesh position={[-0.5, 2.8, 0]} castShadow>
        <boxGeometry args={[18, 0.1, 2.2]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* High-Efficiency Photovoltaic Panels */}
      {[-7.5, -5.2, -2.9, -0.6, 1.7, 4.0, 6.3].map((x) => (
        <mesh key={x} position={[x, 2.88, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[2.0, 0.04, 2.0]} />
          <meshStandardMaterial
            color={isSolarGenerating ? '#064e3b' : '#1e293b'}
            emissive={isSolarGenerating ? '#10b981' : '#000000'}
            emissiveIntensity={isSolarGenerating ? 0.45 : 0}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ))}

      {/* Active Solar Holographic Sign */}
      {isSolarGenerating && (
        <Text position={[-0.5, 3.35, 0]} fontSize={0.28} color="#16a34a" anchorX="center" fontWeight={800}>
          ☀ SOLAR CANOPY ({formatPower(solarGeneration)} kW)
        </Text>
      )}
    </group>
  );
}

/** Energy Substation Building & Power Transformer Area */
function EnergySubstationArea({ solarGeneration, evLoad }) {
  return (
    <group position={[14, 0, 0.5]}>
      {/* Operations & Switchgear Building */}
      <mesh castShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[4.2, 2.8, 6.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Modern Tinted Glass Windows */}
      {[-1, 0, 1].map((row) =>
        [-0.8, 0.8].map((col) => (
          <mesh key={`${row}-${col}`} position={[col, 1.4 + row * 0.7, 3.26]}>
            <boxGeometry args={[0.6, 0.45, 0.02]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.1} metalness={0.9} transparent opacity={0.85} />
          </mesh>
        ))
      )}

      {/* 100 kVA Transformer Substation Unit */}
      <group position={[-1.2, 0.45, -4]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.9, 1.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Cooling Fins */}
        {[-0.5, -0.2, 0.1, 0.4].map((x) => (
          <mesh key={x} position={[x, 0, 0.62]}>
            <boxGeometry args={[0.03, 0.7, 0.15]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        ))}
        {/* Warning Plate */}
        <mesh position={[0, 0.15, 0.62]}>
          <planeGeometry args={[0.35, 0.2]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      </group>

      {/* Substation Labels */}
      <Text position={[0, 3.0, 3.26]} fontSize={0.24} color="#0f172a" anchorX="center" fontWeight={800}>
        GRID SUBSTATION
      </Text>
      <Text position={[-1.2, 1.1, -3.2]} fontSize={0.18} color="#166534" anchorX="center" fontWeight={700}>
        TRANSFORMER (100 kVA)
      </Text>
    </group>
  );
}

/** Full 3D Parking Lot Scene */
function FullParkingScene({
  vehicles,
  chargers,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  filter,
  solarGeneration,
  evLoad
}) {
  const chargerMap = useMemo(() => {
    const m = {};
    (chargers || []).forEach(c => { m[c.id] = c; });
    return m;
  }, [chargers]);

  const vehicleBySpace = useMemo(() => {
    const placements = {};
    (vehicles || []).forEach((vehicle, index) => {
      const space = PARKING_SPACES[index];
      if (space) placements[space.id] = vehicle;
    });
    return placements;
  }, [vehicles]);

  return (
    <>
      {/* Studio Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[14, 22, 14]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={70}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-14, 12, -8]} intensity={0.5} />

      {/* Environment Background Color & Depth Fog */}
      <color attach="background" args={['#edf2f7']} />
      <fog attach="fog" args={['#edf2f7', 35, 95]} />

      {/* Ground & Infrastructure */}
      <ModernParkingGround />
      <SolarRooftopCanopy solarGeneration={solarGeneration} />
      <EnergySubstationArea solarGeneration={solarGeneration} evLoad={evLoad} />

      {/* All 20 Parking Spaces */}
      {PARKING_SPACES.map((space) => {
        const ev         = vehicleBySpace[space.id] || null;
        const charger    = ev?.chargerId ? chargerMap[ev.chargerId] || null : null;
        const isSelected = selectedId === space.id;
        const isHovered  = hoveredId === space.id;

        return (
          <ParkingSlotAssembly
            key={space.id}
            space={space}
            ev={ev}
            charger={charger}
            selected={isSelected}
            hovered={isHovered}
            onSelect={onSelect}
            onHover={onHover}
            filter={filter}
          />
        );
      })}
    </>
  );
}

// ─── DETAIL SLIDEOUT DRAWER ───────────────────────────────────────────────────

function DetailDrawer({ selection, onClose, navigate }) {
  if (!selection) return null;
  const { space, ev, charger } = selection;
  const cfg = ev ? getStatusConfig(ev.status) : getStatusConfig('Empty');

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '320px',
      height: '100%',
      background: '#ffffff',
      borderLeft: '1px solid #e2e8f0',
      boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      animation: 'slideInRight 0.2s ease',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '1.25rem',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Parking Bay
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {space.id}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body Content */}
      {ev ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            background: cfg.bgColor,
            color: cfg.color,
            border: `1px solid ${cfg.borderColor}`,
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            width: 'fit-content'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
            <span>{cfg.label}</span>
          </div>

          {/* Vehicle Identity */}
          <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{ev.id}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{ev.name || 'Tesla Model 3'}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Driver: {ev.ownerName || 'Resident Operator'}</div>
          </div>

          {/* Key Telemetry Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {[
              { icon: <Battery size={14} color="#16a34a" />, label: 'Current Battery', value: `${formatPercent(ev.currentSoc)}%` },
              { icon: <Battery size={14} color="#3b82f6" />, label: 'Target Battery', value: ev.targetSoc == null ? '—' : `${formatPercent(ev.targetSoc)}%` },
              { icon: <Zap size={14} color="#f59e0b" />, label: 'Allocated Power', value: `${formatPower(ev.allocatedPower)} kW` },
              { icon: <Zap size={14} color="#34d399" />, label: 'Actual Power', value: `${formatPower(ev.actualChargingPower)} kW` },
              { icon: <Clock size={14} color="#6366f1" />, label: 'Scheduled Departure', value: ev.departureTime || '—' },
              { icon: <Activity size={14} color="#ec4899" />, label: 'Optimizer Priority', value: ev.priority || '—' },
              { icon: <Clock size={14} color="#14b8a6" />, label: 'Est. Completion', value: ev.estimatedCompletion || '—' },
              { icon: <Gauge size={14} color="#0ea5e9" />, label: 'Estimated Range', value: `${formatDistance(ev.estimatedRange)} km` },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b' }}>
                  {icon}
                  <span>{label}</span>
                </div>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Battery Level Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              <span>Battery Status</span>
              <span>{formatPercent(ev.currentSoc)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.max(0, ev.currentSoc ?? ev.battery ?? 0))}%`,
                height: '100%',
                background: cfg.color,
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* Navigation to Full EV Details (Requirement #27) */}
          <button
            onClick={() => navigate('/ev-management')}
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: '#14532d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.75rem 1rem',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(20, 83, 45, 0.25)'
            }}
          >
            <Eye size={15} />
            <span>View EV Details</span>
          </button>
        </div>
      ) : (
        /* Empty Slot State */
        <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            background: '#f8fafc',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase'
          }}>
            <span>● Available / Empty</span>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
            This parking space is currently vacant and ready for EV arrival.
          </div>

          {charger ? (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Associated Charger Kiosk
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Charger ID:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{charger.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Power Rating:</span>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{charger.maxPower || 11} kW (Level 2)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Network State:</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>● Online & Idle</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
              ✕ No charger installed at this space
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN 3D PARKING LOT PAGE COMPONENT ───────────────────────────────────────

export default function ParkingLot3DPage() {
  const navigate    = useNavigate();
  const systemState = useSystemState();
  const {
    vehicles = [],
    chargers = [],
    evLoad = 0,
    remainingCapacity = 0,
    solarGeneration = 0,
    activeScenario = 'NORMAL',
    backendStatus,
    backendControls,
    commandStates
  } = systemState;

  const liveVehicles = backendStatus === 'LIVE' ? vehicles : [];

  const [selectedSpace, setSelectedSpace] = useState(null);
  const [hoveredId,     setHoveredId]     = useState(null);
  const [filter,        setFilter]        = useState('All');
  const [cameraView,    setCameraView]    = useState('3D');
  const controlsRef = useRef();

  const totalSpaces  = PARKING_SPACES.length;
  const occupied     = liveVehicles.length;
  const charging     = liveVehicles.filter(v => v.status === 'Charging').length;
  const notCharging  = occupied - charging;
  const empty        = Math.max(0, totalSpaces - occupied);

  const handleSelect = useCallback((space, ev, charger) => {
    setSelectedSpace({ space, ev, charger });
  }, []);

  const handleHover = useCallback((id) => {
    setHoveredId(id);
  }, []);

  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      setCameraView('3D');
    }
  }, []);

  const setTopView = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(0, 24, 0.01);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      setCameraView('Top');
    }
  }, []);

  const set3DView = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(0, 16, 20);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      setCameraView('3D');
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f4f6f8' }}>
      {/* Top Header Bar with Scenarios and View Controls */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        flexShrink: 0
      }}>
        {/* Left: Page Title + Simulation Mode Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16a34a'
          }}>
            <Layers3 size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                Parking Lot 3D
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                background: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                fontSize: '0.7rem',
                fontWeight: '800'
              }}>
                <span className="status-dot pulse" style={{ background: '#16a34a' }} />
                <span>SIMULATION MODE</span>
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Real-time smart EV parking digital twin · 20 Bays
            </div>
          </div>
        </div>

        {/* Center: Live Demo Scenario Triggers (Requirement #18 & #25) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '3px', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
          {DEMO_SCENARIOS.map((sc) => {
            const Icon = sc.icon;
            const isActive = activeScenario === sc.name;
            return (
              <button
                key={sc.name}
                onClick={() => backendControls.activateScenario(sc.name)}
                disabled={backendStatus !== 'LIVE' || commandStates[`scenario:${sc.name}`] === 'SENDING'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: isActive ? '#14532d' : 'transparent',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={12} color={isActive ? '#ffffff' : sc.color} />
                <span>{sc.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Vehicle Filters + Camera Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? '#ffffff' : 'transparent',
                  color: filter === f ? '#0f172a' : '#64748b',
                  boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Camera View Presets */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={set3DView}
              style={{
                background: cameraView === '3D' ? '#14532d' : '#ffffff',
                color: cameraView === '3D' ? '#ffffff' : '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <Layers3 size={13} />
              <span>3D</span>
            </button>
            <button
              onClick={setTopView}
              style={{
                background: cameraView === 'Top' ? '#14532d' : '#ffffff',
                color: cameraView === 'Top' ? '#ffffff' : '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <Grid3X3 size={13} />
              <span>Top</span>
            </button>
            <button
              onClick={resetCamera}
              title="Reset Camera View"
              style={{
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.35rem 0.55rem',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Floating Live Telemetry Statistics Overlay (Requirement #15) */}
        <div style={{
          position: 'absolute',
          top: '1.25rem',
          left: '1.25rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1rem 1.15rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          zIndex: 10,
          minWidth: '210px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.65rem' }}>
            PARKING LOT TELEMETRY
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Total Spaces:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{totalSpaces}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Occupied:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{occupied}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#16a34a' }}>● Charging:</span>
              <span style={{ fontWeight: 800, color: '#16a34a' }}>{charging}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Not Charging:</span>
              <span style={{ fontWeight: 800, color: '#64748b' }}>{notCharging}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#94a3b8' }}>Empty:</span>
              <span style={{ fontWeight: 800, color: '#94a3b8' }}>{empty}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Total EV Load:</span>
              <span style={{ fontWeight: 800, color: '#16a34a' }}>{formatPower(evLoad)} kW</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Grid Headroom:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatPower(remainingCapacity)} kW</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: '#d97706' }}>☀ Solar Output:</span>
              <span style={{ fontWeight: 800, color: '#d97706' }}>{formatPower(solarGeneration)} kW</span>
            </div>
          </div>
        </div>

        {/* Legend Overlay (Bottom Left) */}
        <div style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '1.25rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '0.65rem 0.95rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
          zIndex: 10,
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
            Vehicle States
          </div>
          <div style={{ display: 'flex', gap: '0.85rem' }}>
            {[
              { color: '#16a34a', label: 'Charging' },
              { color: '#d97706', label: 'Grid Paused' },
              { color: '#2563eb', label: 'Waiting' },
              { color: '#0891b2', label: 'Complete' },
              { color: '#94a3b8', label: 'Empty' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Hint */}
        <div style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(6px)',
          border: '1px solid #e2e8f0',
          borderRadius: '9999px',
          padding: '0.4rem 1rem',
          fontSize: '0.72rem',
          color: '#64748b',
          fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          Click any vehicle or slot to inspect · Left-click drag to rotate · Scroll to zoom
        </div>

        {/* Three.js Canvas */}
        <Canvas
          camera={{ position: [0, 16, 20], fov: 48, near: 0.1, far: 200 }}
          shadows
          onPointerMissed={() => setSelectedSpace(null)}
          gl={{ antialias: true, alpha: false }}
        >
          <Suspense fallback={null}>
            <FullParkingScene
              vehicles={liveVehicles}
              chargers={chargers}
              selectedId={selectedSpace?.space?.id}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onHover={handleHover}
              filter={filter}
              solarGeneration={solarGeneration}
              evLoad={evLoad}
            />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            minDistance={5}
            maxDistance={55}
            maxPolarAngle={Math.PI / 2.05}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        {/* Interactive Detail Slideout Panel (Requirement #11 & #12) */}
        {backendStatus !== 'LIVE' && <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 20, padding: '0.75rem 1rem', border: '1px solid #fca5a5', background: '#fff1f2', color: '#991b1b', borderRadius: '8px', fontWeight: 700 }}>BACKEND OFFLINE · LOCAL 3D VEHICLES HIDDEN</div>}

        {selectedSpace && (
          <DetailDrawer
            selection={selectedSpace}
            onClose={() => setSelectedSpace(null)}
            navigate={navigate}
          />
        )}
      </div>
    </div>
  );
}
