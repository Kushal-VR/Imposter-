import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { RigidBody } from '@react-three/rapier';
import { BoxGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial } from 'three';

const boxGeo = new BoxGeometry(1, 1, 1);
const sphereGeo = new SphereGeometry(0.5, 16, 16);
const cylGeo = new CylinderGeometry(0.5, 0.5, 1, 16);

export function World() {
  const { world } = useGameStore();

  // Cache materials by color to avoid creating thousands of materials
  const materials = useMemo(() => {
    const mats: Record<string, MeshStandardMaterial> = {};
    const colors = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#4ade80', '#ffffff'];
    colors.forEach(c => {
      mats[c] = new MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1 });
    });
    return mats;
  }, []);

  return (
    <>
      {/* Ground Plane */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -2, 0]} userData={{ isGround: true }}>
        <mesh receiveShadow>
          <boxGeometry args={[1000, 2, 1000]} />
          <meshStandardMaterial color="#2d5a27" roughness={1} metalness={0} />
        </mesh>
      </RigidBody>
      <gridHelper args={[1000, 100, "#4ade80", "#1a3a16"]} position={[0, -0.99, 0]} />

      {Object.values(world).map((block) => {
        const shape = block.shape || 'cube';
        const geo = shape === 'sphere' ? sphereGeo : shape === 'cylinder' ? cylGeo : boxGeo;
        // Fallback to a new material if color isn't cached (though it should be)
        const mat = materials[block.color] || new MeshStandardMaterial({ color: block.color });

        return (
          <RigidBody
            key={`${block.x},${block.y},${block.z}`}
            position={[block.x, block.y, block.z]}
            type="fixed"
            colliders={shape === 'sphere' ? 'ball' : shape === 'cylinder' ? 'hull' : 'cuboid'}
            userData={{ isBlock: true, x: block.x, y: block.y, z: block.z }}
          >
            <mesh castShadow receiveShadow geometry={geo} material={mat} />
          </RigidBody>
        );
      })}
    </>
  );
}
