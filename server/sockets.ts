import { Server, Socket } from 'socket.io';
import { Room, Player, Block } from './types';
import { query } from './db';
import {
  WORDS,
  BUILD_DURATION,
  DISCUSSION_DURATION,
  SABOTAGE_RADIUS,
  MIN_PLAYERS_TO_START,
} from '../lib/constants';

// ─── In-memory game state ────────────────────────────────────────────────────
const rooms: Record<string, Room> = {};

/**
 * Reverse index: socket.id → roomId.
 * Eliminates the O(n) scan that was repeated in every event handler, turning
 * room lookup from O(rooms × players) to O(1).
 */
const socketToRoom: Record<string, string> = {};

/** Per-room interval handles, keyed by roomId. Cleared on room destruction. */
const roomIntervals: Record<string, ReturnType<typeof setInterval>[]> = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the roomId for a given socket, or null if not in any room. */
function getRoomId(socketId: string): string | null {
  return socketToRoom[socketId] ?? null;
}

/** Cancel & remove all timers for a room to prevent memory leaks. */
function clearRoomIntervals(roomId: string): void {
  if (roomIntervals[roomId]) {
    roomIntervals[roomId].forEach(clearInterval);
    delete roomIntervals[roomId];
  }
}

/** Register a timer for a room so it can be cancelled on cleanup. */
function addRoomInterval(
  roomId: string,
  handle: ReturnType<typeof setInterval>
): void {
  if (!roomIntervals[roomId]) roomIntervals[roomId] = [];
  roomIntervals[roomId].push(handle);
}

/** Destroy a room and clean up all associated state. */
function destroyRoom(io: Server, roomId: string): void {
  clearRoomIntervals(roomId);
  const room = rooms[roomId];
  if (room) {
    // Remove all socket→room mappings for this room
    for (const playerId of Object.keys(room.players)) {
      delete socketToRoom[playerId];
    }
    delete rooms[roomId];
    console.log(`Room ${roomId} destroyed`);
  }
}

/** Sanitize user-supplied strings to prevent XSS/spam. */
function sanitize(str: unknown, maxLength = 50): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'`]/g, '').trim().slice(0, maxLength);
}

// ─── Socket setup ────────────────────────────────────────────────────────────

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);

    // ── joinRoom ──────────────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomId: rawRoomId, name: rawName }) => {
      const roomId = sanitize(rawRoomId, 20);
      const name = sanitize(rawName, 24);

      if (!roomId || !name) {
        socket.emit('gameError', 'Invalid room ID or name.');
        return;
      }

      console.log(`Player ${socket.id} joining room ${roomId} as ${name}`);
      socket.join(roomId);
      socketToRoom[socket.id] = roomId;

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

    // ── move ──────────────────────────────────────────────────────────────────
    socket.on(
      'move',
      (data: {
        position: [number, number, number];
        rotation: [number, number, number];
      }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId) return;

        const player = rooms[roomId].players[socket.id];
        if (player) {
          player.position = data.position;
          player.rotation = data.rotation;
          socket.to(roomId).emit('playerMoved', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation,
          });
        }
      }
    );

    // ── placeBlock ────────────────────────────────────────────────────────────
    socket.on('placeBlock', (block: Block) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Build') return;

      const key = `${block.x},${block.y},${block.z}`;
      room.world[key] = block;
      io.to(roomId).emit('blockPlaced', block);
    });

    // ── removeBlock ───────────────────────────────────────────────────────────
    socket.on('removeBlock', (pos: { x: number; y: number; z: number }) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Build') return;

      const key = `${pos.x},${pos.y},${pos.z}`;
      if (room.world[key]) {
        delete room.world[key];
        io.to(roomId).emit('blockRemoved', pos);
      }
    });

    // ── updateBlock ───────────────────────────────────────────────────────────
    socket.on('updateBlock', (block: Block) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Build') return;

      const key = `${block.x},${block.y},${block.z}`;
      if (room.world[key]) {
        room.world[key] = block;
        io.to(roomId).emit('blockUpdated', block);
      }
    });

    // ── sabotage ──────────────────────────────────────────────────────────────
    socket.on('sabotage', (position: [number, number, number]) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      const player = room.players[socket.id];

      if (room.phase !== 'Build' || player?.role !== 'imposter') return;

      const [px, py, pz] = position;
      const blocksToRemove: { x: number; y: number; z: number }[] = [];

      for (const key in room.world) {
        const block = room.world[key];
        // Never destroy the floor (y === -1)
        if (block.y === -1) continue;

        const dx = block.x - px;
        const dy = block.y - py;
        const dz = block.z - pz;

        if (dx * dx + dy * dy + dz * dz <= SABOTAGE_RADIUS * SABOTAGE_RADIUS) {
          blocksToRemove.push({ x: block.x, y: block.y, z: block.z });
        }
      }

      blocksToRemove.forEach((pos) => {
        const key = `${pos.x},${pos.y},${pos.z}`;
        delete room.world[key];
        io.to(roomId).emit('blockRemoved', pos);
      });
    });

    // ── toggleReady ───────────────────────────────────────────────────────────
    socket.on('toggleReady', () => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const player = rooms[roomId].players[socket.id];
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('playerReadyStateChanged', {
          id: socket.id,
          isReady: player.isReady,
        });
      }
    });

    // ── startGame ─────────────────────────────────────────────────────────────
    socket.on('startGame', () => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      const playerIds = Object.keys(room.players);

      // Require at least 2 players so there can be one builder and one imposter
      if (playerIds.length < MIN_PLAYERS_TO_START) {
        socket.emit(
          'gameError',
          `Need at least ${MIN_PLAYERS_TO_START} players to start`
        );
        return;
      }

      room.phase = 'Build';
      room.secretWord = WORDS[Math.floor(Math.random() * WORDS.length)];

      const imposterId =
        playerIds[Math.floor(Math.random() * playerIds.length)];

      playerIds.forEach((id) => {
        room.players[id].role = id === imposterId ? 'imposter' : 'builder';
        io.to(id).emit('gameStarted', {
          phase: room.phase,
          role: room.players[id].role,
          secretWord: id === imposterId ? null : room.secretWord,
        });
      });

      // ── Build phase timer ────────────────────────────────────────────────
      room.timer = BUILD_DURATION;

      const buildInterval = setInterval(() => {
        // Guard: room may have been destroyed mid-timer
        if (!rooms[roomId]) {
          clearInterval(buildInterval);
          return;
        }

        room.timer--;
        io.to(roomId).emit('timerUpdate', room.timer);

        if (room.timer <= 0) {
          clearInterval(buildInterval);

          // ── Discussion phase timer ───────────────────────────────────────
          room.phase = 'Discussion';
          io.to(roomId).emit('phaseChanged', room.phase);
          room.timer = DISCUSSION_DURATION;

          const discInterval = setInterval(() => {
            if (!rooms[roomId]) {
              clearInterval(discInterval);
              return;
            }

            room.timer--;
            io.to(roomId).emit('timerUpdate', room.timer);

            if (room.timer <= 0) {
              clearInterval(discInterval);
              room.phase = 'Voting';
              io.to(roomId).emit('phaseChanged', room.phase);
            }
          }, 1000);

          addRoomInterval(roomId, discInterval);
        }
      }, 1000);

      addRoomInterval(roomId, buildInterval);
    });

    // ── vote ──────────────────────────────────────────────────────────────────
    socket.on('vote', (votedId: string) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const room = rooms[roomId];
      if (room.phase !== 'Voting') return;

      // Prevent double-voting
      if (room.votes[socket.id]) return;

      // Validate that votedId is an actual player in this room
      if (!room.players[votedId]) return;

      room.votes[socket.id] = votedId;
      io.to(roomId).emit('voteCast', { voterId: socket.id, votedId });

      // Check if ALL remaining/connected players have voted
      const activePlayers = Object.keys(room.players);
      const voteCount = Object.keys(room.votes).length;

      if (voteCount >= activePlayers.length) {
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

        // Save result to DB (non-blocking)
        if (imposterId) {
          const voteCounts: Record<string, number> = {};
          for (const votedFor of Object.values(room.votes)) {
            voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
          }

          let maxVotes = 0;
          let mostVotedId = '';
          for (const [id, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
              maxVotes = count;
              mostVotedId = id;
            }
          }

          const imposterWon = mostVotedId !== imposterId;

          query(
            'INSERT INTO game_results (room_id, imposter_id, imposter_name, imposter_won) VALUES ($1, $2, $3, $4)',
            [roomId, imposterId, imposterName, imposterWon]
          ).catch((err) => console.error('Failed to save game result:', err));
        }
      }
    });

    // ── chat ──────────────────────────────────────────────────────────────────
    socket.on('chat', (rawMessage: unknown) => {
      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      const message = sanitize(rawMessage, 200);
      if (!message) return;

      const player = rooms[roomId].players[socket.id];
      io.to(roomId).emit('chatMessage', { sender: player.name, message });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);

      const roomId = getRoomId(socket.id);
      if (!roomId) return;

      // Clean up reverse index
      delete socketToRoom[socket.id];

      const room = rooms[roomId];
      if (!room) return;

      delete room.players[socket.id];
      io.to(roomId).emit('playerLeft', socket.id);

      if (Object.keys(room.players).length === 0) {
        destroyRoom(io, roomId);
      }
    });
  });
}
