import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Zap, Pause, CheckCircle2, RotateCcw } from 'lucide-react';

/**
 * Detailed 3D Electric Vehicle geometry generator.
 * Tailors proportions, contours, lights, and details according to the vehicle model.
 */
function VehicleModel3D({ vehicle }) {
  const modelName = (vehicle?.name || vehicle?.model || 'Tesla Model 3').toLowerCase();
  const status = vehicle?.status || 'Waiting';
  const isCharging = status === 'Charging';
  const isPaused = status === 'Paused';
  const isComplete = status === 'Completed';

  // Determine model-specific styling archetype
  const modelConfig = useMemo(() => {
    if (modelName.includes('ioniq')) {
      // Hyundai Ioniq 5: Retro-futuristic angular crossover with pixel LEDs
      return {
        type: 'ioniq',
        length: 2.25,
        width: 1.12,
        height: 0.38,
        cabinLength: 1.42,
        cabinWidth: 0.94,
        cabinHeight: 0.36,
        cabinOffset: -0.02,
        groundClearance: 0.22,
        wheelRadius: 0.23,
        rimRadius: 0.15,
        wheelbase: 0.72,
        trackWidth: 0.58,
        paintColor: '#64748b', // Cyber Grey Metallic
        accentColor: '#0f172a',
        pixelLights: true,
        suvStance: true,
        displayName: 'Hyundai Ioniq 5'
      };
    }
    if (modelName.includes('nexon')) {
      // Tata Nexon EV: Sporty compact Indian SUV with floating roof
      return {
        type: 'nexon',
        length: 2.05,
        width: 1.08,
        height: 0.42,
        cabinLength: 1.35,
        cabinWidth: 0.92,
        cabinHeight: 0.38,
        cabinOffset: -0.04,
        groundClearance: 0.25,
        wheelRadius: 0.23,
        rimRadius: 0.14,
        wheelbase: 0.65,
        trackWidth: 0.56,
        paintColor: '#0284c7', // Signature Teal Blue
        roofColor: '#f8fafc', // Dual-tone floating white roof
        accentColor: '#1e293b',
        suvStance: true,
        roofRails: true,
        displayName: 'Tata Nexon EV'
      };
    }
    if (modelName.includes('zs')) {
      // MG ZS EV: Premium urban electric crossover
      return {
        type: 'mg',
        length: 2.18,
        width: 1.1,
        height: 0.39,
        cabinLength: 1.4,
        cabinWidth: 0.93,
        cabinHeight: 0.36,
        cabinOffset: -0.02,
        groundClearance: 0.23,
        wheelRadius: 0.23,
        rimRadius: 0.14,
        wheelbase: 0.69,
        trackWidth: 0.57,
        paintColor: '#b91c1c', // Trophy Dynamic Red
        accentColor: '#1e293b',
        suvStance: true,
        roofRails: true,
        displayName: 'MG ZS EV'
      };
    }
    if (modelName.includes('model y')) {
      // Tesla Model Y: Sleek compact electric SUV with glass panoramic roof
      return {
        type: 'modely',
        length: 2.28,
        width: 1.14,
        height: 0.38,
        cabinLength: 1.5,
        cabinWidth: 0.96,
        cabinHeight: 0.35,
        cabinOffset: -0.01,
        groundClearance: 0.23,
        wheelRadius: 0.24,
        rimRadius: 0.15,
        wheelbase: 0.74,
        trackWidth: 0.59,
        paintColor: '#0f172a', // Solid Black
        accentColor: '#18181b',
        suvStance: true,
        glassRoof: true,
        displayName: 'Tesla Model Y'
      };
    }
    // Default / Tesla Model 3: Aerodynamic sports sedan
    return {
      type: 'model3',
      length: 2.22,
      width: 1.06,
      height: 0.32,
      cabinLength: 1.34,
      cabinWidth: 0.9,
      cabinHeight: 0.31,
      cabinOffset: -0.04,
      groundClearance: 0.2,
      wheelRadius: 0.22,
      rimRadius: 0.14,
      wheelbase: 0.72,
      trackWidth: 0.55,
      paintColor: '#f8fafc', // Pearl White Multi-Coat
      accentColor: '#1e293b',
      glassRoof: true,
      displayName: 'Tesla Model 3'
    };
  }, [modelName]);

  // Charging port status illumination
  const portColor = isCharging ? '#22c55e' : isPaused ? '#f59e0b' : isComplete ? '#06b6d4' : '#64748b';
  const portRef = useRef();

  useFrame(() => {
    if (portRef.current && isCharging) {
      // Gentle pulse on charging port
      const intensity = 1.5 + Math.sin(Date.now() * 0.005) * 0.8;
      portRef.current.material.emissiveIntensity = intensity;
    }
  });

  const c = modelConfig;
  const halfLen = c.length / 2;
  const halfWidth = c.width / 2;
  const chassisY = c.groundClearance + c.height / 2;
  const cabinY = c.groundClearance + c.height + c.cabinHeight / 2 - 0.03;

  return (
    <group position={[0, 0, 0]}>
      {/* ── Soft Radial Contact Shadow under wheels ── */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[c.width * 1.35, c.length * 1.25]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* ── Lower Main Aerodynamic Chassis ── */}
      <mesh position={[0, chassisY, 0]} castShadow receiveShadow>
        <boxGeometry args={[c.width, c.height, c.length]} />
        <meshStandardMaterial
          color={c.paintColor}
          roughness={0.18}
          metalness={0.78}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* ── Sculpted Front Hood Slope ── */}
      <mesh
        position={[0, chassisY + c.height * 0.28, halfLen * 0.65]}
        rotation={[-0.18, 0, 0]}
        castShadow
      >
        <boxGeometry args={[c.width * 0.94, c.height * 0.5, halfLen * 0.65]} />
        <meshStandardMaterial
          color={c.paintColor}
          roughness={0.18}
          metalness={0.78}
        />
      </mesh>

      {/* ── Sculpted Rear Trunk Slope / Diffuser ── */}
      <mesh
        position={[0, chassisY + c.height * 0.18, -halfLen * 0.72]}
        rotation={[0.16, 0, 0]}
        castShadow
      >
        <boxGeometry args={[c.width * 0.94, c.height * 0.45, halfLen * 0.55]} />
        <meshStandardMaterial
          color={c.paintColor}
          roughness={0.18}
          metalness={0.78}
        />
      </mesh>

      {/* ── Cabin / Greenhouse (Upper Body) ── */}
      <mesh position={[0, cabinY, c.cabinOffset]} castShadow>
        <boxGeometry args={[c.cabinWidth, c.cabinHeight, c.cabinLength]} />
        <meshStandardMaterial
          color={c.roofColor || c.paintColor}
          roughness={0.2}
          metalness={0.75}
        />
      </mesh>

      {/* ── Front Windshield ── */}
      <mesh
        position={[0, cabinY + 0.01, c.cabinOffset + c.cabinLength / 2 + 0.01]}
        rotation={[0.42, 0, 0]}
      >
        <planeGeometry args={[c.cabinWidth * 0.92, c.cabinHeight * 0.94]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.08}
          metalness={0.92}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* ── Rear Windshield ── */}
      <mesh
        position={[0, cabinY + 0.01, c.cabinOffset - c.cabinLength / 2 - 0.01]}
        rotation={[-0.42, 0, 0]}
      >
        <planeGeometry args={[c.cabinWidth * 0.92, c.cabinHeight * 0.94]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.08}
          metalness={0.92}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* ── Side Windows (Left & Right) ── */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (c.cabinWidth / 2 + 0.005), cabinY, c.cabinOffset]}
          rotation={[0, side * Math.PI / 2, 0]}
        >
          <planeGeometry args={[c.cabinLength * 0.88, c.cabinHeight * 0.82]} />
          <meshStandardMaterial
            color="#0f172a"
            roughness={0.08}
            metalness={0.9}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}

      {/* ── Panoramic Glass Roof (Tesla / Modern EV) ── */}
      {c.glassRoof && (
        <mesh position={[0, cabinY + c.cabinHeight / 2 + 0.004, c.cabinOffset]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[c.cabinWidth * 0.85, c.cabinLength * 0.9]} />
          <meshStandardMaterial color="#090d16" roughness={0.05} metalness={0.95} />
        </mesh>
      )}

      {/* ── Roof Rails (SUV Stance) ── */}
      {c.roofRails && (
        <group position={[0, cabinY + c.cabinHeight / 2 + 0.03, c.cabinOffset]}>
          <mesh position={[-c.cabinWidth * 0.44, 0, 0]}>
            <boxGeometry args={[0.03, 0.03, c.cabinLength * 0.85]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[c.cabinWidth * 0.44, 0, 0]}>
            <boxGeometry args={[0.03, 0.03, c.cabinLength * 0.85]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* ── 4 Premium Alloy Wheels & Rubber Tires ── */}
      {[
        [-c.trackWidth, c.wheelRadius,  c.wheelbase], // Front Left
        [ c.trackWidth, c.wheelRadius,  c.wheelbase], // Front Right
        [-c.trackWidth, c.wheelRadius, -c.wheelbase], // Rear Left
        [ c.trackWidth, c.wheelRadius, -c.wheelbase], // Rear Right
      ].map(([wx, wy, wz], idx) => {
        const isRight = wx > 0;
        return (
          <group key={idx} position={[wx, wy, wz]}>
            {/* Rubber Tread Tire */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[c.wheelRadius, c.wheelRadius, 0.15, 24]} />
              <meshStandardMaterial color="#0f172a" roughness={0.88} />
            </mesh>
            {/* Multi-Spoke Alloy Rim */}
            <mesh
              rotation={[0, 0, Math.PI / 2]}
              position={[isRight ? 0.078 : -0.078, 0, 0]}
            >
              <cylinderGeometry args={[c.rimRadius, c.rimRadius, 0.02, 16]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
            {/* Red / Sport Brake Caliper behind rim */}
            <mesh position={[isRight ? 0.05 : -0.05, 0.06, 0]}>
              <boxGeometry args={[0.04, 0.08, 0.06]} />
              <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* ── Front LED Headlights (Signature DRLs) ── */}
      {c.pixelLights ? (
        // Parametric Pixel Dual Light Bar (Ioniq 5)
        <group position={[0, chassisY + 0.08, halfLen + 0.012]}>
          <mesh position={[-c.width * 0.32, 0, 0]}>
            <boxGeometry args={[0.24, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={2.5} />
          </mesh>
          <mesh position={[c.width * 0.32, 0, 0]}>
            <boxGeometry args={[0.24, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={2.5} />
          </mesh>
        </group>
      ) : (
        // Sleek Swept-Back LED Headlights
        <>
          <mesh position={[-c.width * 0.34, chassisY + 0.07, halfLen + 0.012]}>
            <boxGeometry args={[0.22, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} />
          </mesh>
          <mesh position={[c.width * 0.34, chassisY + 0.07, halfLen + 0.012]}>
            <boxGeometry args={[0.22, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} />
          </mesh>
        </>
      )}

      {/* ── Rear LED Taillight Bar ── */}
      <mesh position={[0, chassisY + 0.1, -halfLen - 0.012]}>
        <boxGeometry args={[c.width * 0.88, 0.05, 0.02]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={2.0}
        />
      </mesh>

      {/* ── EV Charging Port Door (Rear Left Quarter) ── */}
      <group position={[-halfWidth - 0.005, chassisY + 0.08, -halfLen * 0.55]}>
        {/* Charging Port Ring */}
        <mesh ref={portRef} rotation={[0, -Math.PI / 2, 0]}>
          <ringGeometry args={[0.035, 0.055, 16]} />
          <meshStandardMaterial
            color={portColor}
            emissive={portColor}
            emissiveIntensity={isCharging ? 2.2 : 0.8}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Plugged Charging Connector Cable (when Charging / Paused / Completed) */}
        {(isCharging || isPaused || isComplete) && (
          <group position={[-0.06, 0, 0]}>
            {/* Charger Handle Nozzle */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.038, 0.12, 12]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Heavy-Duty Flexible Cable draping down to floor */}
            <mesh position={[-0.08, -0.22, 0]} rotation={[0, 0, 0.25]}>
              <cylinderGeometry args={[0.018, 0.018, 0.42, 10]} />
              <meshStandardMaterial color="#0f172a" roughness={0.7} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/**
 * Interactive 3D Viewer Canvas Component with OrbitControls
 */
export default function EV3DViewer({ vehicle }) {
  const controlsRef = useRef();

  const handleResetCamera = (e) => {
    e.stopPropagation();
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const status = vehicle?.status || 'Waiting';
  const isCharging = status === 'Charging';
  const isPaused = status === 'Paused';
  const isComplete = status === 'Completed';

  const badgeColor = isCharging ? '#16a34a' : isPaused ? '#d97706' : isComplete ? '#0891b2' : '#64748b';
  const badgeText = isCharging ? 'Actively Charging' : isPaused ? 'Charging Paused' : isComplete ? 'Fully Charged' : 'Standing By';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
      {/* Canvas Scene */}
      <Canvas
        shadows
        camera={{ position: [2.6, 1.4, 2.6], fov: 42 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={1.1} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-4, 4, -4]} intensity={0.6} color="#93c5fd" />
          <pointLight position={[0, 2, 0]} intensity={0.5} />

          {/* Vehicle Turntable Pedestal */}
          <mesh position={[0, -0.04, 0]} receiveShadow>
            <cylinderGeometry args={[2.0, 2.1, 0.08, 36]} />
            <meshStandardMaterial
              color="#0f172a"
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.75, 1.85, 36]} />
            <meshBasicMaterial color={isCharging ? '#22c55e' : '#334155'} />
          </mesh>

          {/* 3D Car Model */}
          <VehicleModel3D vehicle={vehicle} />

          {/* Controls with professional constraints */}
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={2.1}
            maxDistance={4.5}
            maxPolarAngle={Math.PI / 2 - 0.06} // Keep above floor
            minPolarAngle={0.2}
            autoRotate={true}
            autoRotateSpeed={0.8}
            dampingFactor={0.05}
          />
        </Suspense>
      </Canvas>

      {/* Top Left Floating Status Badge */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '4px 10px',
        borderRadius: '9999px',
        border: `1px solid ${badgeColor}55`,
        pointerEvents: 'none'
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: badgeColor,
          boxShadow: isCharging ? `0 0 8px ${badgeColor}` : 'none'
        }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
          {badgeText}
        </span>
      </div>

      {/* Bottom Floating Interaction Cue */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '12px',
        fontSize: '10px',
        color: '#94a3b8',
        fontWeight: 600,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span>🖱 Drag to rotate • Scroll to zoom</span>
      </div>

      {/* Reset Camera Button */}
      <button
        onClick={handleResetCamera}
        title="Reset Camera View"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '10px',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid #334155',
          borderRadius: '6px',
          color: '#cbd5e1',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        <RotateCcw size={11} />
        <span>Reset</span>
      </button>
    </div>
  );
}
