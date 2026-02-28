'use client';

import { Color } from 'three';
import { Canvas } from '@react-three/fiber';
import { Sky, PointerLockControls, KeyboardControls, OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { Lobby } from '../components/Lobby';
import { GameUI } from '../components/GameUI';
import { MobileControls } from '../components/MobileControls';
import { Player } from '../game/Player';
import { OtherPlayer } from '../game/OtherPlayer';
import { World } from '../game/World';

const SKY_COLOR = '#4a90d9';

export default function GameApp() {
  const { players, socket, phase } = useGameStore();

  return (
    // Inline style so Tailwind purge can never drop the bg
    <div className="w-full h-screen overflow-hidden relative" style={{ background: '#000' }}>
      <Lobby />
      <GameUI />
      <MobileControls />

      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
          { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
          { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
          { name: 'right', keys: ['ArrowRight', 'KeyD'] },
          { name: 'jump', keys: ['Space'] },
        ]}
      >
        <Canvas
          shadows
          camera={{ position: [0, 8, 16], fov: 75 }}
          // alpha:false = opaque WebGL context. The canvas NEVER shows the
          // browser's white page background through transparent pixels.
          gl={{ antialias: true, alpha: false }}
          // onCreated sets BOTH the renderer clearColor AND scene.background,
          // guaranteeing a visible sky colour even if Sky mesh doesn't load.
          onCreated={({ gl, scene }) => {
            gl.setClearColor(SKY_COLOR, 1);
            scene.background = new Color(SKY_COLOR);
          }}
        >
          {/* Sky atmosphere mesh — renders over scene.background */}
          <Sky
            distance={450000}
            sunPosition={[100, 20, 100]}
            inclination={0}
            azimuth={0.25}
            turbidity={8}
            rayleigh={0.5}
            mieCoefficient={0.005}
            mieDirectionalG={0.8}
          />

          {/*
           * Hemispheric light: sunlight colour from sky, green bounce from ground.
           * This is critical for making the floor visible — without it, the top
           * face of the ground receives no light from above in a physically plausible way.
           */}
          <hemisphereLight args={['#87CEEB', '#4ade80', 1.2]} />
          <ambientLight intensity={0.4} />
          <directionalLight
            castShadow
            position={[30, 60, 20]}
            intensity={1.5}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-60}
            shadow-camera-right={60}
            shadow-camera-top={60}
            shadow-camera-bottom={-60}
            shadow-bias={-0.001}
          />

          <Physics gravity={[0, -20, 0]}>
            <World />
            {phase !== 'Lobby' && <Player />}
            {Object.values(players).map((p) => {
              if (p.id === socket?.id) return null;
              return <OtherPlayer key={p.id} player={p} />;
            })}
          </Physics>

          {/* PointerLock during Build only — other phases have UI over canvas */}
          {phase === 'Build' && <PointerLockControls makeDefault />}

          {/* Lobby preview orbit */}
          {phase === 'Lobby' && (
            <OrbitControls
              makeDefault
              autoRotate
              autoRotateSpeed={0.5}
              enableZoom={false}
              enablePan={false}
            />
          )}
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
