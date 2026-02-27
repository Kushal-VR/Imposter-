export type Position = [number, number, number];

export interface Player {
  id: string;
  roomId: string;
  name: string;
  position: Position;
  rotation: [number, number, number];
  role: 'imposter' | 'builder' | null;
  isReady: boolean;
}

export interface Block {
  x: number;
  y: number;
  z: number;
  color: string;
  shape?: 'cube' | 'sphere' | 'cylinder';
}

export type GamePhase = 'Lobby' | 'Build' | 'Discussion' | 'Voting' | 'Result';

export interface Room {
  id: string;
  players: Record<string, Player>;
  world: Record<string, Block>; // key: "x,y,z"
  phase: GamePhase;
  secretWord: string | null;
  votes: Record<string, string>; // voterId -> votedId
  timer: number;
}
