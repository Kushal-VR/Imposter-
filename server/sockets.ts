import { Server, Socket } from 'socket.io';
import { Room, Player, Block } from './types';
import { query } from './db';

const rooms: Record<string, Room> = {};
const WORDS = ['Castle', 'Spaceship', 'Pyramid', 'Treehouse', 'Bridge', 'Robot'];

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinRoom', ({ roomId, name }) => {
      console.log(`Player ${socket.id} joining room ${roomId} as ${name}`);
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        console.log(`Creating room ${roomId}`);
        rooms[roomId] = {
          id: roomId,
          players: {},
          world: {},
          phase: 'Lobby',
          secretWord: null,
          votes: {},
          timer: 0,
        };
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
      console.log(`Sent roomState to ${socket.id}`);
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

    socket.on('updateBlock', (block: Block) => {
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
      if (room.world[key]) {
        room.world[key] = block;
        io.to(roomId).emit('blockUpdated', block);
      }
    });

    socket.on('sabotage', (position: [number, number, number]) => {
      let roomId = null;
      for (const r in rooms) {
        if (rooms[r].players[socket.id]) {
          roomId = r;
          break;
        }
      }
      if (!roomId) return;

      const room = rooms[roomId];
      const player = room.players[socket.id];
      
      if (room.phase !== 'Build' || player.role !== 'imposter') return;

      const radius = 3;
      const [px, py, pz] = position;
      
      const blocksToRemove: {x: number, y: number, z: number}[] = [];

      for (const key in room.world) {
        const block = room.world[key];
        // Don't destroy the floor (y = -1)
        if (block.y === -1) continue;

        const dx = block.x - px;
        const dy = block.y - py;
        const dz = block.z - pz;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (distance <= radius) {
          blocksToRemove.push({ x: block.x, y: block.y, z: block.z });
        }
      }

      blocksToRemove.forEach(pos => {
        const key = `${pos.x},${pos.y},${pos.z}`;
        delete room.world[key];
        io.to(roomId).emit('blockRemoved', pos);
      });
    });

    socket.on('toggleReady', () => {
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
        player.isReady = !player.isReady;
        io.to(roomId).emit('playerReadyStateChanged', {
          id: socket.id,
          isReady: player.isReady
        });
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
      if (playerIds.length < 1) {
        socket.emit('error', 'Need at least 1 player to start');
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

        let imposterId = '';
        let imposterName = '';
        for (const id in room.players) {
          if (room.players[id].role === 'imposter') {
            imposterId = id;
            imposterName = room.players[id].name;
            break;
          }
        }

        io.to(roomId).emit('gameEnded', { votes: room.votes, imposterId });

        // Calculate result and save to DB
        try {
          if (imposterId) {
            // Count votes
            const voteCounts: Record<string, number> = {};
            for (const voter in room.votes) {
              const votedFor = room.votes[voter];
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

            // Imposter wins if they are not the most voted
            const imposterWon = mostVotedId !== imposterId;

            query(
              'INSERT INTO game_results (room_id, imposter_id, imposter_name, imposter_won) VALUES ($1, $2, $3, $4)',
              [roomId, imposterId, imposterName, imposterWon]
            ).catch(err => console.error('Failed to save game result:', err));
          }
        } catch (err) {
          console.error('Error processing game result:', err);
        }
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
