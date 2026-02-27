import { useGameStore } from '../store/gameStore';
import { RigidBody } from '@react-three/rapier';

export function World() {
  const { world } = useGameStore();

  return (
    <>
      {Object.values(world).map((block) => {
        const shape = block.shape || 'cube';
        return (
          <RigidBody
            key={`${block.x},${block.y},${block.z}`}
            position={[block.x, block.y, block.z]}
            type="fixed"
            colliders={shape === 'sphere' ? 'ball' : shape === 'cylinder' ? 'hull' : 'cuboid'}
            userData={{ isBlock: true, x: block.x, y: block.y, z: block.z }}
          >
            <mesh castShadow receiveShadow>
              {shape === 'cube' && <boxGeometry args={[1, 1, 1]} />}
              {shape === 'sphere' && <sphereGeometry args={[0.5, 16, 16]} />}
              {shape === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 16]} />}
              <meshStandardMaterial color={block.color} />
            </mesh>
          </RigidBody>
        );
      })}
    </>
  );
}
