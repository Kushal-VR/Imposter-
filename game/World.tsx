import { useMemo, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { InstancedMesh, Object3D, Color } from 'three';
import { InstancedRigidBodies } from '@react-three/rapier';

const CHUNK_SIZE = 16;

export function World() {
  const { world } = useGameStore();

  // Group blocks into chunks
  const chunks = useMemo(() => {
    const chunkMap = new Map<string, any[]>();
    
    for (const key in world) {
      const block = world[key];
      const cx = Math.floor(block.x / CHUNK_SIZE);
      const cy = Math.floor(block.y / CHUNK_SIZE);
      const cz = Math.floor(block.z / CHUNK_SIZE);
      const chunkKey = `${cx},${cy},${cz}`;
      
      if (!chunkMap.has(chunkKey)) {
        chunkMap.set(chunkKey, []);
      }
      chunkMap.get(chunkKey)!.push(block);
    }
    
    return Array.from(chunkMap.entries());
  }, [world]);

  return (
    <>
      {chunks.map(([key, blocks]) => (
        <Chunk key={key} blocks={blocks} />
      ))}
    </>
  );
}

function Chunk({ blocks }: { blocks: any[] }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  const positions = useMemo(() => blocks.map(b => [b.x, b.y, b.z]), [blocks]);
  const rotations = useMemo(() => blocks.map(() => [0, 0, 0]), [blocks]);
  const scales = useMemo(() => blocks.map(() => [1, 1, 1]), [blocks]);

  useEffect(() => {
    if (meshRef.current) {
      blocks.forEach((block, i) => {
        dummy.position.set(block.x, block.y, block.z);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        meshRef.current!.setColorAt(i, color.set(block.color));
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [blocks, dummy, color]);

  return (
    <InstancedRigidBodies
      positions={positions as any}
      rotations={rotations as any}
      scales={scales as any}
      colliders="cuboid"
      type="fixed"
    >
      <instancedMesh ref={meshRef} args={[undefined, undefined, blocks.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
    </InstancedRigidBodies>
  );
}
