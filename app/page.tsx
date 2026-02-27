'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('./GameApp'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center text-emerald-400 font-mono text-xl animate-pulse">
      Loading Game Engine...
    </div>
  ),
});

export default function Page() {
  return <GameApp />;
}
