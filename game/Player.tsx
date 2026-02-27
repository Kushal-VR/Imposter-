import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { Vector3, Vector2, Euler, Raycaster, MeshBasicMaterial, BoxGeometry, Mesh } from 'three';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';

const SPEED = 5;
const JUMP_FORCE = 8;
const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316'];

function BlockEffect({ position, color, type, shape = 'cube' }: { position: Vector3, color: string, type: 'place' | 'remove', shape?: 'cube' | 'sphere' | 'cylinder' }) {
  const meshRef = useRef<Mesh>(null);
  const [scale, setScale] = useState(type === 'place' ? 0.5 : 1);
  const [opacity, setOpacity] = useState(1);

  useFrame(() => {
    if (!meshRef.current) return;
    if (type === 'place') {
      setScale(s => Math.min(1.1, s + 0.1));
      setOpacity(o => Math.max(0, o - 0.05));
    } else {
      setScale(s => Math.max(0, s - 0.1));
      setOpacity(o => Math.max(0, o - 0.1));
    }
    meshRef.current.scale.set(scale, scale, scale);
    (meshRef.current.material as MeshBasicMaterial).opacity = opacity;
  });

  if (opacity <= 0) return null;

  return (
    <mesh ref={meshRef} position={position}>
      {shape === 'cube' && <boxGeometry args={[1.1, 1.1, 1.1]} />}
      {shape === 'sphere' && <sphereGeometry args={[0.55, 16, 16]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[0.55, 0.55, 1.1, 16]} />}
      <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
    </mesh>
  );
}

export function Player() {
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const bodyRef = useRef<any>(null);
  const [, getKeys] = useKeyboardControls();
  const { move, phase, placeBlock, removeBlock, world: gameWorld, role, sabotage, lastSabotage, setLastSabotage, currentColor, currentShape, setCurrentColor, setCurrentShape } = useGameStore();

  const [effects, setEffects] = useState<{ id: number, pos: Vector3, color: string, type: 'place' | 'remove', shape?: 'cube' | 'sphere' | 'cylinder' }[]>([]);
  const handRef = useRef<Mesh>(null);

  const addEffect = (pos: Vector3, color: string, type: 'place' | 'remove', shape?: 'cube' | 'sphere' | 'cylinder') => {
    const id = Date.now() + Math.random();
    setEffects(prev => [...prev, { id, pos, color, type, shape }]);
    setTimeout(() => {
      setEffects(prev => prev.filter(e => e.id !== id));
    }, 1000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const index = parseInt(e.key) - 1;
        if (COLORS[index]) setCurrentColor(COLORS[index]);
      }
      if (e.code === 'KeyZ') setCurrentShape('cube');
      if (e.code === 'KeyX') setCurrentShape('sphere');
      if (e.code === 'KeyC') setCurrentShape('cylinder');
      
      if (e.code === 'KeyE' && role === 'imposter' && phase === 'Build') {
        const now = Date.now();
        if (now - lastSabotage > 5000) { // 5 second cooldown
          if (bodyRef.current) {
            const pos = bodyRef.current.translation();
            sabotage([pos.x, pos.y, pos.z]);
            setLastSabotage(now);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [role, phase, lastSabotage, sabotage]);

  useEffect(() => {
    let isDragging = false;
    let previousTouch: Touch | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousTouch = e.touches[0];
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !previousTouch) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - previousTouch.clientX;
      const deltaY = touch.clientY - previousTouch.clientY;
      
      const euler = new Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);
      
      euler.y -= deltaX * 0.005;
      euler.x -= deltaY * 0.005;
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
      
      camera.quaternion.setFromEuler(euler);
      previousTouch = touch;
    };

    const handleTouchEnd = () => {
      isDragging = false;
      previousTouch = null;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [camera]);

  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      if ((document.pointerLockElement || ('ontouchstart' in window)) && phase === 'Build') {
        const raycaster = new Raycaster();
        raycaster.setFromCamera(new Vector2(0, 0), camera);

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
            const key = `${hitPos.x},${hitPos.y},${hitPos.z}`;
            const color = gameWorld[key]?.color || '#ffffff';
            const shape = gameWorld[key]?.shape || 'cube';
            removeBlock({ x: hitPos.x, y: hitPos.y, z: hitPos.z });
            addEffect(hitPos, color, 'remove', shape);
          } else if (e.button === 0) { // Left click - place
            placeBlock({
              x: prevPos.x,
              y: prevPos.y,
              z: prevPos.z,
              color: currentColor,
              shape: currentShape
            });
            addEffect(prevPos, currentColor, 'place', currentShape);
          }
        } else if (e.button === 0) {
           // Place in air if no hit but within range
           const placePos = pos.clone().add(dir.clone().multiplyScalar(3));
           const finalPos = new Vector3(Math.round(placePos.x), Math.round(placePos.y), Math.round(placePos.z));
           placeBlock({
              x: finalPos.x,
              y: finalPos.y,
              z: finalPos.z,
              color: currentColor,
              shape: currentShape
            });
            addEffect(finalPos, currentColor, 'place', currentShape);
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

    if (jump && hit && (hit as any).toi < 0.2) {
      bodyRef.current.setLinvel({ x: velocity.x, y: JUMP_FORCE, z: velocity.z }, true);
    }

    // Update camera position
    const pos = bodyRef.current.translation();
    camera.position.set(pos.x, pos.y + 0.8, pos.z); // Eye level

    if (handRef.current) {
      handRef.current.position.copy(camera.position);
      handRef.current.rotation.copy(camera.rotation);
      handRef.current.translateZ(-1.5);
      handRef.current.translateX(0.8);
      handRef.current.translateY(-0.5);
    }
  });

  return (
    <>
      <RigidBody ref={bodyRef} colliders={false} mass={1} type="dynamic" position={[0, 5, 0]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[0.5, 0.5]} />
      </RigidBody>
      {effects.map(effect => (
        <BlockEffect key={effect.id} position={effect.pos} color={effect.color} type={effect.type} />
      ))}
      <mesh ref={handRef} scale={[0.3, 0.3, 0.3]}>
        {currentShape === 'cube' && <boxGeometry args={[1, 1, 1]} />}
        {currentShape === 'sphere' && <sphereGeometry args={[0.5, 16, 16]} />}
        {currentShape === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 16]} />}
        <meshStandardMaterial color={currentColor} />
      </mesh>
    </>
  );
}
