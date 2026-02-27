import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function GameUI() {
  const { phase, role, secretWord, timer, players, votes, vote, sendChat, messages, socket, lastSabotage, currentColor, currentShape, setCurrentColor, setCurrentShape } = useGameStore();
  const [chatInput, setChatInput] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316'];
  const SHAPES = ['cube', 'sphere', 'cylinder'] as const;

  useEffect(() => {
    if (role !== 'imposter' || phase !== 'Build') return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = 5000 - (now - lastSabotage);
      if (diff > 0) {
        setCooldown(Math.ceil(diff / 1000));
      } else {
        setCooldown(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [lastSabotage, role, phase]);

  if (phase === 'Lobby') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-6">
      <div className="flex justify-between items-start">
        <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-700/50 shadow-lg pointer-events-auto">
          <h2 className="text-2xl font-bold text-white mb-1">Phase: <span className="text-emerald-400">{phase}</span></h2>
          <p className="text-zinc-300 font-mono text-lg">{timer}s remaining</p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-700/50 shadow-lg pointer-events-auto text-right">
          <h3 className="text-sm uppercase tracking-widest text-zinc-400 font-semibold mb-1">Your Role</h3>
          <p className={`text-xl font-bold ${role === 'imposter' ? 'text-red-500' : 'text-emerald-400'}`}>
            {role === 'imposter' ? 'IMPOSTER' : 'BUILDER'}
          </p>
          {secretWord && (
            <p className="text-zinc-300 mt-2">
              <span className="text-zinc-500 text-sm">Word:</span> <span className="font-mono font-bold">{secretWord}</span>
            </p>
          )}
          {role === 'imposter' && phase === 'Build' && (
            <div className="mt-4">
              <p className="text-xs text-zinc-400 mb-2">Press &apos;E&apos; or click below to destroy nearby blocks</p>
              <button 
                onClick={() => {
                  if (cooldown === 0) {
                    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
                  }
                }}
                disabled={cooldown > 0}
                className={`w-full font-bold py-2 px-4 rounded-lg transition-colors text-sm ${
                  cooldown > 0 
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {cooldown > 0 ? `COOLDOWN (${cooldown}s)` : 'SABOTAGE'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-700/50 shadow-lg w-80 pointer-events-auto flex flex-col h-64">
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="font-bold text-emerald-400">{m.sender}: </span>
                <span className="text-zinc-300">{m.message}</span>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (chatInput.trim()) {
              sendChat(chatInput);
              setChatInput('');
            }
          }} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Type to chat..."
            />
          </form>
        </div>

        {phase === 'Voting' && (
          <div className="bg-zinc-900/90 backdrop-blur-xl p-6 rounded-2xl border border-zinc-700 shadow-2xl pointer-events-auto max-w-sm w-full">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Vote for the Imposter</h3>
            <div className="space-y-2">
              {Object.values(players).map(p => {
                if (p.id === socket?.id) return null;
                const hasVoted = votes[socket?.id || ''] !== undefined;
                const isVotedFor = votes[socket?.id || ''] === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => vote(p.id)}
                    disabled={hasVoted}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                      isVotedFor 
                        ? 'bg-emerald-500 text-white' 
                        : hasVoted 
                          ? 'bg-zinc-800 text-zinc-500' 
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'Result' && (
          <div className="bg-zinc-900/90 backdrop-blur-xl p-6 rounded-2xl border border-zinc-700 shadow-2xl pointer-events-auto max-w-sm w-full text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Game Over</h3>
            
            {(() => {
              const { imposterId } = useGameStore.getState();
              
              // Count votes
              const voteCounts: Record<string, number> = {};
              for (const voter in votes) {
                const votedFor = votes[voter];
                voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
              }

              // Find max votes
              let maxVotes = 0;
              let mostVotedId = '';
              for (const id in voteCounts) {
                if (voteCounts[id] > maxVotes) {
                  maxVotes = voteCounts[id];
                  mostVotedId = id;
                }
              }

              const imposterWon = mostVotedId !== imposterId;
              const imposterName = players[imposterId || '']?.name || 'Unknown';
              const mostVotedName = players[mostVotedId]?.name || 'No one';

              return (
                <div className="mb-6">
                  <div className={`text-3xl font-black mb-4 ${imposterWon ? 'text-red-500' : 'text-emerald-500'}`}>
                    {imposterWon ? 'IMPOSTER WINS!' : 'BUILDERS WIN!'}
                  </div>
                  
                  <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-left">
                    <p className="text-zinc-300 mb-2">
                      The Imposter was: <span className="font-bold text-red-400">{imposterName}</span>
                    </p>
                    <p className="text-zinc-300">
                      Most voted player: <span className="font-bold text-white">{mostVotedName}</span> ({maxVotes} votes)
                    </p>
                  </div>

                  <div className="space-y-2 text-left">
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Vote Breakdown</h4>
                    {Object.entries(votes).map(([voterId, votedId]) => (
                      <div key={voterId} className="text-zinc-300 text-sm">
                        <span className="font-bold">{players[voterId]?.name}</span> voted for <span className="font-bold text-red-400">{players[votedId]?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <p className="text-zinc-500 text-sm mt-4">Refresh to play again.</p>
          </div>
        )}
      </div>
      
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/50 -translate-y-1/2"></div>
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/50 -translate-x-1/2"></div>
      </div>

      {/* Toolbar */}
      {phase === 'Build' && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-2">
          <div className="bg-zinc-900/80 backdrop-blur-md p-2 rounded-xl border border-zinc-700/50 shadow-lg flex gap-2">
            {COLORS.map((color, i) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-10 h-10 rounded-lg border-2 transition-transform ${currentColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: color }}
                title={`Color ${i + 1}`}
              />
            ))}
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-md p-2 rounded-xl border border-zinc-700/50 shadow-lg flex gap-2">
            {SHAPES.map((shape) => (
              <button
                key={shape}
                onClick={() => setCurrentShape(shape)}
                className={`px-4 py-2 rounded-lg font-bold text-sm uppercase transition-all ${currentShape === shape ? 'bg-emerald-500 text-white ring-2 ring-white scale-105 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
