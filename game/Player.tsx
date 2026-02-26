import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { Vector3, Euler, Raycaster } from 'three';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';

const SPEED = 5;
const JUMP_FORCE = 8;
const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316'];

export function Player() {
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const bodyRef = useRef<any>(null);
  const [, getKeys] = useKeyboardControls();
  const { move, phase, placeBlock, removeBlock, world: gameWorld } = useGameStore();

  const [currentColor, setCurrentColor] = useState('#ef4444');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const index = parseInt(e.key) - 1;
        if (COLORS[index]) setCurrentColor(COLORS[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      if (document.pointerLockElement && phase === 'Build') {
        const raycaster = new Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);

        // Simple raycast against blocks
        // We can do this by checking distance to all blocks, or using Three.js raycaster if we had meshes.
        // Since we use instanced mesh or individual meshes, let's just do a simple grid traversal
        
        const pos = camera.position.clone();
        const dir = raycaster.ray.direction.clone().normalize();
        
        let hit = false;
        let hitPos = new Vector3();
        let prevPos = new Vector3();

        // Raymarch
        for (let i = 0; i < 10; i += 0.1) {
          const checkPos = pos.clone().add(dir.clone().multiplyScalar(i));
          const gridX = Math.round(checkPos.x);
          const gridY = Math.round(checkPos.y);
          const gridZ = Math.round(checkPos.z);
          
          const key = `${gridX},${gridY},${gridZ}`;
          if (gameWorld[key]) {
            hit = true;
            hitPos.set(gridX, gridY, gridZ);
            break;
          }
          prevPos.set(Math.round(checkPos.x), Math.round(checkPos.y), Math.round(checkPos.z));
        }

        if (hit) {
          if (e.button === 2) { // Right click - remove
            removeBlock({ x: hitPos.x, y: hitPos.y, z: hitPos.z });
          } else if (e.button === 0) { // Left click - place
            placeBlock({
              x: prevPos.x,
              y: prevPos.y,
              z: prevPos.z,
              color: currentColor
            });
          }
        } else if (e.button === 0) {
           // Place in air if no hit but within range
           const placePos = pos.clone().add(dir.clone().multiplyScalar(3));
           placeBlock({
              x: Math.round(placePos.x),
              y: Math.round(placePos.y),
              z: Math.round(placePos.z),
              color: currentColor
            });
        }
      }
    };

    window.addEventListener('mousedown', handleMouseClick);
    return () => window.removeEventListener('mousedown', handleMouseClick);
  }, [camera, phase, gameWorld, currentColor, placeBlock, removeBlock]);

  // Sync position to server
  useEffect(() => {
    const interval = setInterval(() => {
      if (bodyRef.current) {
        const pos = bodyRef.current.translation();
        const rot = camera.rotation;
        move([pos.x, pos.y, pos.z], [rot.x, rot.y, rot.z]);
      }
    }, 50); // 20fps sync
    return () => clearInterval(interval);
  }, [camera, move]);

  useFrame(() => {
    if (!bodyRef.current || phase === 'Lobby') return;

    const { forward, backward, left, right, jump } = getKeys();
    
    // Movement
    const velocity = bodyRef.current.linvel();
    const frontVector = new Vector3(0, 0, (backward ? 1 : 0) - (forward ? 1 : 0));
    const sideVector = new Vector3((left ? 1 : 0) - (right ? 1 : 0), 0, 0);
    
    const direction = new Vector3()
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(SPEED)
      .applyEuler(camera.rotation);

    bodyRef.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z }, true);

    // Jumping
    const rayOrigin = bodyRef.current.translation();
    rayOrigin.y -= 1; // Bottom of capsule
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new rapier.Ray(rayOrigin, rayDir);
    const hit = world.castRay(ray, 0.5, true);

    if (jump && hit && hit.toi < 0.2) {
      bodyRef.current.setLinvel({ x: velocity.x, y: JUMP_FORCE, z: velocity.z }, true);
    }

    // Update camera position
    const pos = bodyRef.current.translation();
    camera.position.set(pos.x, pos.y + 0.8, pos.z); // Eye level
  });

  return (
    <RigidBody ref={bodyRef} colliders={false} mass={1} type="dynamic" position={[0, 5, 0]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.5]} />
    </RigidBody>
  );
}
