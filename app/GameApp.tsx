'use client';

import { Canvas } from '@react-three/fiber';
import { Sky, PointerLockControls, KeyboardControls, Environment, ContactShadows } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { Lobby } from '../components/Lobby';
import { GameUI } from '../components/GameUI';
import { MobileControls } from '../components/MobileControls';
import { Player } from '../game/Player';
import { OtherPlayer } from '../game/OtherPlayer';
import { World } from '../game/World';

export default function GameApp() {
  const { players, socket, phase } = useGameStore();

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
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
        <Canvas shadows camera={{ fov: 75 }}>
          <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
          <ambientLight intensity={0.4} />
          <directionalLight
            castShadow
            position={[50, 50, 20]}
            intensity={1.5}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
            shadow-bias={-0.0001}
          />
          <Environment preset="city" />

          <Physics gravity={[0, -20, 0]}>
            <World />
            {phase !== 'Lobby' && <Player />}
            
            {Object.values(players).map(p => {
              if (p.id === socket?.id) return null;
              return <OtherPlayer key={p.id} player={p} />;
            })}
          </Physics>

          {phase === 'Build' && <PointerLockControls />}
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
