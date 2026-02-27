import { useEffect, useState, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import { useGameStore } from '../store/gameStore';

export function MobileControls() {
  const { phase } = useGameStore();
  const [isMobile, setIsMobile] = useState(false);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile || phase === 'Lobby') return null;

  const updateKey = (key: string, code: string, isDown: boolean) => {
    const state = keysRef.current as any;
    if (state[key] !== isDown) {
      state[key] = isDown;
      window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code }));
    }
  };

  const handleMove = (e: any) => {
    const { x, y } = e;
    
    updateKey('w', 'KeyW', y > 0.3);
    updateKey('s', 'KeyS', y < -0.3);
    updateKey('d', 'KeyD', x > 0.3);
    updateKey('a', 'KeyA', x < -0.3);
  };

  const handleStop = () => {
    updateKey('w', 'KeyW', false);
    updateKey('s', 'KeyS', false);
    updateKey('a', 'KeyA', false);
    updateKey('d', 'KeyD', false);
  };

  const handleJump = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    }, 100);
  };

  return (
    <div className="absolute bottom-10 left-0 right-0 px-10 flex justify-between items-end z-40 pointer-events-none">
      <div className="pointer-events-auto opacity-70">
        <Joystick size={100} baseColor="#333" stickColor="#888" move={handleMove} stop={handleStop} />
      </div>
      
      <div className="pointer-events-auto opacity-70 flex flex-col gap-4">
        <button 
          onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))}
          className="w-16 h-16 rounded-full bg-blue-600 border-2 border-blue-500 text-white font-bold flex items-center justify-center active:bg-blue-700 text-xs"
        >
          CURVE
        </button>
        <button 
          onPointerDown={handleJump}
          className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-600 text-white font-bold flex items-center justify-center active:bg-zinc-700 text-xs"
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
