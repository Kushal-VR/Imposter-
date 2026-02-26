import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Player } from '../server/types';
import { Vector3, Euler, Quaternion } from 'three';

export function OtherPlayer({ player }: { player: Player }) {
  const groupRef = useRef<any>(null);
  const targetPos = useRef(new Vector3(...player.position));
  const targetRot = useRef(new Quaternion().setFromEuler(new Euler(...player.rotation)));

  useEffect(() => {
    targetPos.current.set(...player.position);
    targetRot.current.setFromEuler(new Euler(...player.rotation));
  }, [player.position, player.rotation]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Interpolate position and rotation for smoothness
      groupRef.current.position.lerp(targetPos.current, 0.2);
      groupRef.current.quaternion.slerp(targetRot.current, 0.2);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color={player.role === 'imposter' ? '#ef4444' : '#3b82f6'} />
      </mesh>
      {/* Name tag */}
      <mesh position={[0, 2, 0]}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
