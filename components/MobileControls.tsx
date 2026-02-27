import { useEffect, useState } from 'react';
import { Joystick } from 'react-joystick-component';
import { useGameStore } from '../store/gameStore';

export function MobileControls() {
  const { phase } = useGameStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile || phase === 'Lobby') return null;

  const handleMove = (e: any) => {
    // Dispatch keyboard events to simulate WASD
    const { x, y } = e;
    
    // Reset all
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));

    if (y > 0.5) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    if (y < -0.5) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    if (x > 0.5) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    if (x < -0.5) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
  };

  const handleStop = () => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
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
          onPointerDown={handleJump}
          className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-600 text-white font-bold flex items-center justify-center active:bg-zinc-700"
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
