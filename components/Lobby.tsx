import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-2xl w-full border border-zinc-700 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-3xl font-bold mb-6 text-emerald-400">How to Play</h2>

        <div className="space-y-6 text-zinc-300">
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">Objective</h3>
            <p>Work together to build a secret object, but beware—one of you is the Imposter! The Builders must finish the object and identify the Imposter. The Imposter must blend in, sabotage the build, and avoid detection.</p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-white mb-2">Roles</h3>
            <div className="space-y-4">
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                <h4 className="font-bold text-emerald-400 mb-1">Builders</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You will be given a <span className="font-bold text-white">Secret Word</span> (e.g., &quot;Castle&quot;).</li>
                  <li>Work together to build the object using blocks.</li>
                  <li>Pay attention to who is building what&mdash;the Imposter doesn&apos;t know the word!</li>
                </ul>
              </div>
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                <h4 className="font-bold text-red-400 mb-1">Imposter</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You <span className="font-bold text-white">do not</span> know the Secret Word.</li>
                  <li>Try to figure out what the others are building and blend in.</li>
                  <li>Use your <span className="font-bold text-red-400">Sabotage</span> ability (Press &apos;E&apos;) to destroy nearby blocks and cause chaos.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-white mb-2">Game Phases</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><span className="font-bold text-emerald-400">Build Phase (60s):</span> Everyone builds. Imposter can sabotage.</li>
              <li><span className="font-bold text-blue-400">Discussion Phase (30s):</span> Use the chat to discuss who was acting suspiciously.</li>
              <li><span className="font-bold text-purple-400">Voting Phase:</span> Vote for who you think the Imposter is.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-white mb-2">Controls</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Movement</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">W A S D</span> — Move</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">Space</span> — Jump</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">Mouse</span> — Look around (click canvas first to lock)</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Building</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">Left Click</span> — Place block</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">Right Click</span> — Remove block</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">F</span> — <span className="text-emerald-400 font-bold">Repaint &amp; reshape</span> the block you&apos;re looking at (applies current color + shape)</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">1 – 5</span> — Change block color</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">Z</span> — Cube shape</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">X</span> — Sphere shape</li>
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">C</span> — Cylinder shape</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Imposter Only</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><span className="font-mono bg-zinc-800 px-1 rounded">E</span> — Sabotage (destroys nearby blocks, 5s cooldown)</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

export function Lobby() {
  const [roomIdInput, setRoomIdInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || '';
    }
    return '';
  });
  const [nameInput, setNameInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const { connect, roomId, players, startGame, phase, socket, toggleReady } = useGameStore();

  // Reset connecting state when we successfully join a room.
  // This is done in a useEffect instead of directly during render to avoid
  // the "Cannot update state during render" warning in React Strict Mode.
  useEffect(() => {
    if (isConnecting && roomId) {
      setIsConnecting(false);
    }
  }, [isConnecting, roomId]);

  if (phase !== 'Lobby') return null;

  if (roomId) {
    const allReady =
      Object.values(players).length > 0 &&
      Object.values(players).every((p) => p.isReady);
    const me = socket?.id ? players[socket.id] : null;

    const copyInviteLink = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      navigator.clipboard.writeText(url.toString());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50">
        <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-md w-full border border-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-emerald-400">Room: {roomId}</h2>
            <button
              onClick={copyInviteLink}
              className={`p-2 rounded-lg transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              title="Copy Invite Link"
            >
              {copySuccess ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              )}
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3 text-zinc-300">
              Players ({Object.keys(players).length}/8)
            </h3>
            <ul className="space-y-2">
              {Object.values(players).map((p) => (
                <li key={p.id} className="bg-zinc-800 px-4 py-2 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${p.isReady ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    <span>{p.name}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{p.isReady ? 'Ready' : 'Not Ready'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={toggleReady}
              className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${me?.isReady ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              {me?.isReady ? 'Unready' : 'Ready Up'}
            </button>

            <button
              onClick={startGame}
              disabled={!allReady}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              {allReady ? 'Start Game' : 'Waiting for all to be ready...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-white z-50">
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-md w-full border border-zinc-800">
        <h1 className="text-4xl font-bold mb-2 text-center text-emerald-400">Imposter Architect</h1>
        <p className="text-zinc-400 text-center mb-6">Build together, find the imposter.</p>

        <button
          onClick={() => setShowRules(true)}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 px-4 rounded-lg transition-colors mb-8 text-sm flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          How to Play
        </button>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Your Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Enter your name"
              maxLength={24}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Room Code</label>
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Enter room code"
              maxLength={20}
            />
          </div>
          <button
            onClick={() => {
              if (nameInput && roomIdInput) {
                setIsConnecting(true);
                connect(roomIdInput, nameInput);

                // Failsafe: reset connecting state if server never responds
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
