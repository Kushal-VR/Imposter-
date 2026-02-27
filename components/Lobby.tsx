import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function Lobby() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect, roomId, players, startGame, phase, socket } = useGameStore();

  // Reset connecting state if we successfully join
  if (isConnecting && roomId) {
    setIsConnecting(false);
  }

  if (phase !== 'Lobby') return null;

  if (roomId) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50">
        <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-md w-full border border-zinc-800">
          <h2 className="text-3xl font-bold mb-6 text-center text-emerald-400">Room: {roomId}</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-zinc-300">Players ({Object.keys(players).length}/8)</h3>
            <ul className="space-y-2">
              {Object.values(players).map(p => (
                <li key={p.id} className="bg-zinc-800 px-4 py-2 rounded-lg flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="text-xs text-zinc-500">{p.id.slice(0, 4)}</span>
                </li>
              ))}
            </ul>
          </div>

          {phase === 'Lobby' && (
            <button
              onClick={startGame}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-white z-50">
      <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-md w-full border border-zinc-800">
        <h1 className="text-4xl font-bold mb-2 text-center text-emerald-400">Imposter Architect</h1>
        <p className="text-zinc-400 text-center mb-8">Build together, find the imposter.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Your Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Room Code</label>
            <input
              type="text"
              value={roomIdInput}
              onChange={e => setRoomIdInput(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Enter room code"
            />
          </div>
          <button
            onClick={() => {
              if (nameInput && roomIdInput) {
                setIsConnecting(true);
                connect(roomIdInput, nameInput);
                
                // Timeout to reset connecting state if it fails
                setTimeout(() => {
                  setIsConnecting(false);
                }, 5000);
              }
            }}
            disabled={!nameInput || !roomIdInput || isConnecting}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-4 flex justify-center items-center"
          >
            {isConnecting ? (
              <span className="animate-pulse">Connecting...</span>
            ) : (
              'Join Room'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
