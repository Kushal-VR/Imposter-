import { useMemo, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { MeshStandardMaterial, BoxGeometry, SphereGeometry, CylinderGeometry } from 'three';
import { COLORS } from '../lib/constants';

// ─── Block geometry singletons ────────────────────────────────────────────────
const BOX_GEO = new BoxGeometry(1, 1, 1);
const SPHERE_GEO = new SphereGeometry(0.5, 16, 16);
const CYL_GEO = new CylinderGeometry(0.5, 0.5, 1, 16);

const FALLBACK_MAT = new MeshStandardMaterial({ color: '#888888', roughness: 0.7, metalness: 0.1 });

export function World() {
  const { world } = useGameStore();

  const materials = useMemo(() => {
    const mats: Record<string, MeshStandardMaterial> = {};
    (COLORS as readonly string[]).forEach((c) => {
      mats[c] = new MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1 });
    });
    return mats;
  }, []);

  const dynamicMats = useRef<Record<string, MeshStandardMaterial>>({});

  return (
    <>
      {/*
       * Ground plane — EXPLICIT CuboidCollider instead of colliders="cuboid".
       *
       * colliders="cuboid" auto-generates a collider by reading the mesh geometry
       * bounding box. In Rapier v2 this is unreliable with shared geometries and
       * may produce wrong sizes. CuboidCollider with explicit half-extents
       * [100, 1, 100] creates a guaranteed 200×2×200 physics floor.
       *
       * Geometry position is relative to the RigidBody origin [0, -2, 0]:
       *   Top surface of box  = -2 + 1  = -1  (world y)
       *   Player rests at y≈0 (capsule center), camera at y≈0.8
       */}
      <RigidBody type="fixed" position={[0, -2, 0]} userData={{ isGround: true }}>
        <CuboidCollider args={[100, 1, 100]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[200, 2, 200]} />
          <meshStandardMaterial color="#22c55e" roughness={0.85} metalness={0} />
        </mesh>
      </RigidBody>

      {/* Grid overlay at floor surface level */}
      <gridHelper args={[200, 50, '#15803d', '#166534']} position={[0, -0.99, 0]} />

      {/* ── Placed blocks ── */}
      {Object.values(world).map((block) => {
        const shape = block.shape ?? 'cube';
        const size = block.size ?? 1;
        const half = size / 2;

        const geo =
          shape === 'sphere' ? SPHERE_GEO :
            shape === 'cylinder' ? CYL_GEO :
              BOX_GEO;

        let mat = materials[block.color];
        if (!mat) {
          if (!dynamicMats.current[block.color]) {
            dynamicMats.current[block.color] = new MeshStandardMaterial({
              color: block.color, roughness: 0.7, metalness: 0.1,
            });
          }
          mat = dynamicMats.current[block.color] ?? FALLBACK_MAT;
        }

        return (
          <RigidBody
            key={`${block.x},${block.y},${block.z}`}
            position={[block.x, block.y, block.z]}
            type="fixed"
            userData={{ isBlock: true, x: block.x, y: block.y, z: block.z, size }}
          >
            {/* Explicit collider so size is always correct regardless of geometry */}
            <CuboidCollider args={[half, half, half]} />
            <mesh castShadow receiveShadow geometry={geo} material={mat} scale={[size, size, size]} />
          </RigidBody>
        );
      })}
    </>
  );
}
