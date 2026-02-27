import { useGameStore } from '../store/gameStore';
import { RigidBody } from '@react-three/rapier';

export function World() {
  const { world } = useGameStore();

  return (
    <>
      {Object.values(world).map((block) => (
        <RigidBody
          key={`${block.x},${block.y},${block.z}`}
          position={[block.x, block.y, block.z]}
          type="fixed"
          colliders="cuboid"
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={block.color} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
