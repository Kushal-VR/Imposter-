import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Player, Block, GamePhase, Room } from '../server/types.ts';

interface GameState {
  socket: Socket | null;
  roomId: string | null;
  name: string;
  players: Record<string, Player>;
  world: Record<string, Block>;
  phase: GamePhase;
  secretWord: string | null;
  role: 'imposter' | 'builder' | null;
  timer: number;
  votes: Record<string, string>;
  messages: { sender: string; message: string }[];
  
  connect: (roomId: string, name: string) => void;
  disconnect: () => void;
  move: (position: [number, number, number], rotation: [number, number, number]) => void;
  placeBlock: (block: Block) => void;
  removeBlock: (pos: { x: number, y: number, z: number }) => void;
  startGame: () => void;
  vote: (votedId: string) => void;
  sendChat: (message: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  roomId: null,
  name: '',
  players: {},
  world: {},
  phase: 'Lobby',
  secretWord: null,
  role: null,
  timer: 0,
  votes: {},
  messages: [],

  connect: (roomId: string, name: string) => {
    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on('connect', () => {
      socket.emit('joinRoom', { roomId, name });
    });

    socket.on('roomState', (room: Room) => {
      set({
        roomId,
        name,
        players: room.players,
        world: room.world,
        phase: room.phase,
        secretWord: room.secretWord,
        timer: room.timer,
      });
    });

    socket.on('playerJoined', (player: Player) => {
      set((state) => ({
        players: { ...state.players, [player.id]: player }
      }));
    });

    socket.on('playerLeft', (id: string) => {
      set((state) => {
        const newPlayers = { ...state.players };
        delete newPlayers[id];
        return { players: newPlayers };
      });
    });

    socket.on('playerMoved', (data: { id: string, position: [number, number, number], rotation: [number, number, number] }) => {
      set((state) => {
        const player = state.players[data.id];
        if (!player) return state;
        return {
          players: {
            ...state.players,
            [data.id]: { ...player, position: data.position, rotation: data.rotation }
          }
        };
      });
    });

    socket.on('blockPlaced', (block: Block) => {
      set((state) => ({
        world: { ...state.world, [`${block.x},${block.y},${block.z}`]: block }
      }));
    });

    socket.on('blockRemoved', (pos: { x: number, y: number, z: number }) => {
      set((state) => {
        const newWorld = { ...state.world };
        delete newWorld[`${pos.x},${pos.y},${pos.z}`];
        return { world: newWorld };
      });
    });

    socket.on('gameStarted', (data: { phase: GamePhase, role: any, secretWord: string | null }) => {
      set({ phase: data.phase, role: data.role, secretWord: data.secretWord });
    });

    socket.on('phaseChanged', (phase: GamePhase) => {
      set({ phase });
    });

    socket.on('timerUpdate', (timer: number) => {
      set({ timer });
    });

    socket.on('voteCast', (data: { voterId: string, votedId: string }) => {
      set((state) => ({
        votes: { ...state.votes, [data.voterId]: data.votedId }
      }));
    });

    socket.on('gameEnded', (votes: Record<string, string>) => {
      set({ votes });
    });

    socket.on('chatMessage', (msg: { sender: string, message: string }) => {
      set((state) => ({
        messages: [...state.messages, msg]
      }));
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({ socket: null, roomId: null, players: {}, world: {} });
  },

  move: (position, rotation) => {
    const { socket } = get();
    if (socket) {
      socket.emit('move', { position, rotation });
    }
  },

  placeBlock: (block) => {
    const { socket } = get();
    if (socket) {
      socket.emit('placeBlock', block);
    }
  },

  removeBlock: (pos) => {
    const { socket } = get();
    if (socket) {
      socket.emit('removeBlock', pos);
    }
  },

  startGame: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('startGame');
    }
  },

  vote: (votedId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('vote', votedId);
    }
  },

  sendChat: (message) => {
    const { socket } = get();
    if (socket) {
      socket.emit('chat', message);
    }
  }
}));
