import { Server, Socket } from 'socket.io';
import { Room, Player, Block } from './types.ts';

const rooms: Record<string, Room> = {};
const WORDS = ['Castle', 'Spaceship', 'Pyramid', 'Treehouse', 'Bridge', 'Robot'];

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinRoom', ({ roomId, name }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: {},
          world: {},
          phase: 'Lobby',
          secretWord: null,
          votes: {},
          timer: 0,
        };
        // Generate floor
        for (let x = -10; x <= 10; x++) {
          for (let z = -10; z <= 10; z++) {
            rooms[roomId].world[`${x},-1,${z}`] = { x, y: -1, z, color: '#4ade80' };
          }
        }
      }

      const room = rooms[roomId];
      room.players[socket.id] = {
        id: socket.id,
        roomId,
        name,
        position: [0, 5, 0],
        rotation: [0, 0, 0],
        role: null,
        isReady: false,
      };

      socket.emit('roomState', room);
      socket.to(roomId).emit('playerJoined', room.players[socket.id]);
    });

    socket.on('move', (data: { position: [number, number, number], rotation: [number, number, number] }) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const player = rooms[roomId].players[socket.id];
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
        // Broadcast to others
        socket.to(roomId).emit('playerMoved', {
          id: socket.id,
          position: data.position,
          rotation: data.rotation
        });
      }
    });

    socket.on('placeBlock', (block: Block) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Build') return;

      const key = `${block.x},${block.y},${block.z}`;
      room.world[key] = block;
      io.to(roomId).emit('blockPlaced', block);
    });

    socket.on('removeBlock', (pos: { x: number, y: number, z: number }) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Build') return;

      const key = `${pos.x},${pos.y},${pos.z}`;
      if (room.world[key]) {
        delete room.world[key];
        io.to(roomId).emit('blockRemoved', pos);
      }
    });

    socket.on('startGame', () => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const room = rooms[roomId];
      const playerIds = Object.keys(room.players);
      if (playerIds.length < 2) {
        socket.emit('error', 'Need at least 2 players to start');
        return;
      }

      room.phase = 'Build';
      room.secretWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      
      const imposterId = playerIds[Math.floor(Math.random() * playerIds.length)];
      
      playerIds.forEach(id => {
        room.players[id].role = id === imposterId ? 'imposter' : 'builder';
        io.to(id).emit('gameStarted', {
          phase: room.phase,
          role: room.players[id].role,
          secretWord: id === imposterId ? null : room.secretWord
        });
      });

      // Simple timer for build phase (e.g., 60 seconds)
      room.timer = 60;
      const interval = setInterval(() => {
        room.timer--;
        io.to(roomId).emit('timerUpdate', room.timer);
        if (room.timer <= 0) {
          clearInterval(interval);
          room.phase = 'Discussion';
          io.to(roomId).emit('phaseChanged', room.phase);
          
          // Discussion timer
          room.timer = 30;
          const discInterval = setInterval(() => {
            room.timer--;
            io.to(roomId).emit('timerUpdate', room.timer);
            if (room.timer <= 0) {
              clearInterval(discInterval);
              room.phase = 'Voting';
              io.to(roomId).emit('phaseChanged', room.phase);
            }
          }, 1000);
        }
      }, 1000);
    });

    socket.on('vote', (votedId: string) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Voting') return;

      room.votes[socket.id] = votedId;
      io.to(roomId).emit('voteCast', { voterId: socket.id, votedId });

      if (Object.keys(room.votes).length === Object.keys(room.players).length) {
        room.phase = 'Result';
        io.to(roomId).emit('phaseChanged', room.phase);
        io.to(roomId).emit('gameEnded', room.votes);
      }
    });

    socket.on('chat', (message: string) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const player = rooms[roomId].players[socket.id];
      io.to(roomId).emit('chatMessage', { sender: player.name, message });
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      for (const roomId in rooms) {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          io.to(roomId).emit('playerLeft', socket.id);
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
          }
          break;
        }
      }
    });
  });
}
