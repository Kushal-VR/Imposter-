import { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { Vector3, Euler, Mesh, MeshBasicMaterial } from 'three';
import { RigidBody, CapsuleCollider, useRapier, type RapierRigidBody } from '@react-three/rapier';
import {
  SELECTOR_COLORS,
  SPEED,
  JUMP_FORCE,
  SABOTAGE_COOLDOWN_MS,
  SYNC_POSITION_THRESHOLD,
  SYNC_ROTATION_THRESHOLD,
} from '../lib/constants';

// ─── Block placement visual effect ───────────────────────────────────────────

/**
 * Uses refs instead of useState + useFrame to drive animation, avoiding
 * 60 per-second React state updates which are very expensive.
 */
function BlockEffect({
  position,
  color,
  type,
  shape = 'cube',
}: {
  position: Vector3;
  color: string;
  type: 'place' | 'remove';
  shape?: 'cube' | 'sphere' | 'cylinder';
}) {
  const meshRef = useRef<Mesh>(null);
  const scaleRef = useRef(type === 'place' ? 0.5 : 1);
  const opacityRef = useRef(1);
  const doneRef = useRef(false);

  useFrame(() => {
    if (!meshRef.current || doneRef.current) return;

    if (type === 'place') {
      scaleRef.current = Math.min(1.1, scaleRef.current + 0.1);
      opacityRef.current = Math.max(0, opacityRef.current - 0.05);
    } else {
      scaleRef.current = Math.max(0, scaleRef.current - 0.1);
      opacityRef.current = Math.max(0, opacityRef.current - 0.1);
    }

    const s = scaleRef.current;
    meshRef.current.scale.set(s, s, s);
    (meshRef.current.material as MeshBasicMaterial).opacity = opacityRef.current;

    if (opacityRef.current <= 0) {
      doneRef.current = true;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      {shape === 'cube' && <boxGeometry args={[1.1, 1.1, 1.1]} />}
      {shape === 'sphere' && <sphereGeometry args={[0.55, 16, 16]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[0.55, 0.55, 1.1, 16]} />}
      <meshBasicMaterial color={color} wireframe transparent opacity={1} />
    </mesh>
  );
}

// ─── Local player ─────────────────────────────────────────────────────────────

export function Player() {
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const [, getKeys] = useKeyboardControls();
  const {
    move,
    phase,
    placeBlock,
    removeBlock,
    updateBlock,
    world: gameWorld,
    role,
    sabotage,
    lastSabotage,
    setLastSabotage,
    currentColor,
    currentShape,
    setCurrentColor,
    setCurrentShape,
  } = useGameStore();

  const [effects, setEffects] = useState<
    {
      id: number;
      pos: Vector3;
      color: string;
      type: 'place' | 'remove';
      shape?: 'cube' | 'sphere' | 'cylinder';
    }[]
  >([]);
  const handRef = useRef<Mesh>(null);

  // Track last synced position/rotation for delta throttle
  const lastSyncedPos = useRef<[number, number, number]>([0, 0, 0]);
  const lastSyncedRot = useRef<[number, number, number]>([0, 0, 0]);

  // When game starts, tilt camera slightly downward so the floor is immediately
  // visible. PointerLockControls freely overrides this once user clicks.
  useEffect(() => {
    if (phase === 'Build') {
      camera.rotation.set(-0.25, 0, 0, 'YXZ');
    }
  }, [phase, camera]);


  const addEffect = useCallback(
    (
      pos: Vector3,
      color: string,
      type: 'place' | 'remove',
      shape?: 'cube' | 'sphere' | 'cylinder'
    ) => {
      const id = Date.now() + Math.random();
      setEffects((prev) => [...prev, { id, pos, color, type, shape }]);
      setTimeout(() => {
        setEffects((prev) => prev.filter((e) => e.id !== id));
      }, 1000);
    },
    []
  );

  const handleCurve = useCallback(() => {
    if (phase !== 'Build') return;

    const rayOrigin = camera.position.clone();
    const rayDir = new Vector3();
    camera.getWorldDirection(rayDir);
    // Step slightly forward so we don't hit the player capsule
    const rayStart = rayOrigin.clone().add(rayDir.clone().multiplyScalar(0.5));
    // Use castRayAndGetNormal — same as block-placement code, gives us toi via (hit as any).toi
    const ray = new rapier.Ray(rayStart, rayDir);
    const hit = world.castRayAndGetNormal(ray, 10, true);

    if (!hit?.collider) return;

    const rigidBody = hit.collider.parent();
    if (!rigidBody) return;

    // Narrow all coords to numbers (they come in as any via rigidBody.userData)
    const ud = (rigidBody.userData ?? {}) as Record<string, unknown>;
    const isBlock = Boolean(ud.isBlock);
    if (!isBlock) return;

    const bx = ud.x as number;
    const by = ud.y as number;
    const bz = ud.z as number;
    if (bx == null || by == null || bz == null) return;

    const blockKey = `${bx},${by},${bz}`;
    const block = gameWorld[blockKey];
    if (!block) return;

    // Only carve full-size (size === 1) blocks. Half-blocks cannot be carved further.
    if ((block.size ?? 1) < 1) return;

    // ── Find the exact hit point → sub-voxel octant within this block ──
    const toi = (hit as unknown as { toi: number }).toi;
    const hitPt = ray.pointAt(toi); // Rapier {x, y, z}

    // Which of the 8 octants was hit? sign tells us positive (+1) or negative (-1) half
    const ox: 1 | -1 = hitPt.x - bx >= 0 ? 1 : -1;
    const oy: 1 | -1 = hitPt.y - by >= 0 ? 1 : -1;
    const oz: 1 | -1 = hitPt.z - bz >= 0 ? 1 : -1;

    // Remove the original full-size block
    removeBlock({ x: bx, y: by, z: bz });

    // Place 7 half-blocks (0.5 × 0.5 × 0.5) at the 7 remaining octant centres.
    // Each octant centre is ±0.25 from the block centre (half of 0.5 block size).
    const HALF = 0.25;
    const OCTANTS: [number, number, number][] = [
      [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
      [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
    ];

    for (const [sx, sy, sz] of OCTANTS) {
      if (sx === ox && sy === oy && sz === oz) continue; // skip the carved octant

      placeBlock({
        x: bx + sx * HALF,
        y: by + sy * HALF,
        z: bz + sz * HALF,
        color: block.color,
        shape: 'cube',
        size: 0.5,
      });
    }

    addEffect(new Vector3(bx, by, bz), block.color, 'remove', 'cube');
  }, [phase, camera, rapier, world, gameWorld, removeBlock, placeBlock, addEffect]);

  // ── Keyboard controls ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const index = parseInt(e.key) - 1;
        if (SELECTOR_COLORS[index]) setCurrentColor(SELECTOR_COLORS[index]);
      }
      if (e.code === 'KeyZ') setCurrentShape('cube');
      if (e.code === 'KeyX') setCurrentShape('sphere');
      if (e.code === 'KeyC') setCurrentShape('cylinder');
      if (e.code === 'KeyF') handleCurve();

      if (e.code === 'KeyE' && role === 'imposter' && phase === 'Build') {
        const now = Date.now();
        if (now - lastSabotage > SABOTAGE_COOLDOWN_MS) {
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
  }, [role, phase, lastSabotage, sabotage, setCurrentColor, setCurrentShape, handleCurve, setLastSabotage]);

  // ── Touch look controls ────────────────────────────────────────────────────
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

  // ── Mouse block interaction ────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      if (
        (document.pointerLockElement || 'ontouchstart' in window) &&
        phase === 'Build'
      ) {
        const rayOrigin = camera.position.clone();
        const rayDir = new Vector3();
        camera.getWorldDirection(rayDir);
        rayOrigin.add(rayDir.clone().multiplyScalar(0.5));
        const ray = new rapier.Ray(rayOrigin, rayDir);
        const hit = world.castRayAndGetNormal(ray, 10, true);

        if (hit && hit.collider) {
          const rigidBody = hit.collider.parent();
          if (rigidBody) {
            const userData = rigidBody.userData as any;

            if (userData && userData.isBlock) {
              const hitPos = new Vector3(userData.x, userData.y, userData.z);

              if (e.button === 2) {
                // Right click — remove
                removeBlock({ x: hitPos.x, y: hitPos.y, z: hitPos.z });
                addEffect(
                  hitPos,
                  gameWorld[`${hitPos.x},${hitPos.y},${hitPos.z}`]?.color || '#ffffff',
                  'remove',
                  gameWorld[`${hitPos.x},${hitPos.y},${hitPos.z}`]?.shape
                );
              } else if (e.button === 0) {
                // Left click — place adjacent
                const normal = hit.normal;
                if (!normal) return;

                const absX = Math.abs(normal.x);
                const absY = Math.abs(normal.y);
                const absZ = Math.abs(normal.z);
                const snappedNormal = new Vector3(0, 0, 0);
                if (absX > absY && absX > absZ)
                  snappedNormal.x = Math.sign(normal.x);
                else if (absY > absX && absY > absZ)
                  snappedNormal.y = Math.sign(normal.y);
                else snappedNormal.z = Math.sign(normal.z);

                const placePos = new Vector3(
                  Math.round(hitPos.x + snappedNormal.x),
                  Math.round(hitPos.y + snappedNormal.y),
                  Math.round(hitPos.z + snappedNormal.z)
                );
                placeBlock({
                  x: placePos.x,
                  y: placePos.y,
                  z: placePos.z,
                  color: currentColor,
                  shape: currentShape,
                });
                addEffect(placePos, currentColor, 'place', currentShape);
              }
            } else if (userData && userData.isGround && e.button === 0) {
              // Left click on ground — place
              const hitPos = ray.pointAt((hit as any).toi);
              const normal = hit.normal;
              if (!normal) return;

              const placePos = new Vector3(
                Math.round(hitPos.x + normal.x * 0.5),
                Math.round(hitPos.y + normal.y * 0.5),
                Math.round(hitPos.z + normal.z * 0.5)
              );
              placeBlock({
                x: placePos.x,
                y: placePos.y,
                z: placePos.z,
                color: currentColor,
                shape: currentShape,
              });
              addEffect(placePos, currentColor, 'place', currentShape);
            }
          }
        } else if (e.button === 0) {
          // No hit — place in front of player (3 units away)
          const placePos = rayOrigin.clone().add(rayDir.clone().multiplyScalar(3));
          const finalPos = new Vector3(
            Math.round(placePos.x),
            Math.round(placePos.y),
            Math.round(placePos.z)
          );
          placeBlock({
            x: finalPos.x,
            y: finalPos.y,
            z: finalPos.z,
            color: currentColor,
            shape: currentShape,
          });
          addEffect(finalPos, currentColor, 'place', currentShape);
        }
      }
    };

    window.addEventListener('mousedown', handleMouseClick);
    return () => window.removeEventListener('mousedown', handleMouseClick);
  }, [camera, phase, gameWorld, currentColor, currentShape, placeBlock, removeBlock, world, rapier, addEffect]);

  // ── Position sync (throttled by delta) ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!bodyRef.current) return;

      const pos = bodyRef.current.translation();
      const rot = camera.rotation;

      // Only emit if the player has moved/rotated beyond the threshold
      const [lx, ly, lz] = lastSyncedPos.current;
      const [lrx, lry, lrz] = lastSyncedRot.current;

      const posDelta =
        Math.abs(pos.x - lx) + Math.abs(pos.y - ly) + Math.abs(pos.z - lz);
      const rotDelta =
        Math.abs(rot.x - lrx) + Math.abs(rot.y - lry) + Math.abs(rot.z - lrz);

      if (posDelta > SYNC_POSITION_THRESHOLD || rotDelta > SYNC_ROTATION_THRESHOLD) {
        move([pos.x, pos.y, pos.z], [rot.x, rot.y, rot.z]);
        lastSyncedPos.current = [pos.x, pos.y, pos.z];
        lastSyncedRot.current = [rot.x, rot.y, rot.z];
      }
    }, 50); // Poll at 20fps, but only emit when changed
    return () => clearInterval(interval);
  }, [camera, move]);

  // ── Physics / movement frame loop ─────────────────────────────────────────
  useFrame(() => {
    if (!bodyRef.current || phase === 'Lobby') return;

    const { forward, backward, left, right, jump } = getKeys();
    const velocity = bodyRef.current.linvel();

    const frontVector = new Vector3(
      0,
      0,
      (backward ? 1 : 0) - (forward ? 1 : 0)
    );
    const sideVector = new Vector3((left ? 1 : 0) - (right ? 1 : 0), 0, 0);

    const direction = new Vector3()
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(SPEED)
      .applyEuler(camera.rotation);

    bodyRef.current.setLinvel(
      { x: direction.x, y: velocity.y, z: direction.z },
      true
    );

    if (jump && Math.abs(velocity.y) < 0.05) {
      bodyRef.current.setLinvel(
        { x: velocity.x, y: JUMP_FORCE, z: velocity.z },
        true
      );
    }

    const pos = bodyRef.current.translation();
    camera.position.set(pos.x, pos.y + 0.8, pos.z);

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
      <RigidBody
        ref={bodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 5, 0]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider args={[0.5, 0.5]} />
      </RigidBody>

      {effects.map((effect) => (
        <BlockEffect
          key={effect.id}
          position={effect.pos}
          color={effect.color}
          type={effect.type}
          shape={effect.shape}
        />
      ))}

      {/* In-hand block preview */}
      <mesh ref={handRef} scale={[0.3, 0.3, 0.3]}>
        {currentShape === 'cube' && <boxGeometry args={[1, 1, 1]} />}
        {currentShape === 'sphere' && <sphereGeometry args={[0.5, 16, 16]} />}
        {currentShape === 'cylinder' && (
          <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
        )}
        <meshStandardMaterial color={currentColor} />
      </mesh>
    </>
  );
}
