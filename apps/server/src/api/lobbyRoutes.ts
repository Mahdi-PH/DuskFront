import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { matchMaker } from '@colyseus/core';
import { privateLobbySettingsSchema, roomCodeSchema } from '@velocity-island/shared';
import { requireAuth } from '../auth/requireAuth.js';
import { generateRoomCode } from '../matchmaking/roomCodes.js';

const joinByCodeSchema = z.object({ roomCode: roomCodeSchema });

/** Private lobby creation/join-by-code. Quick/ranked matchmaking is handled entirely
 * client-side via Colyseus's built-in `joinOrCreate('race', {trackId, mode})` +
 * `filterBy` (see index.ts), which is the standard Colyseus matchmaking pattern and
 * needs no extra REST surface. */
export async function registerLobbyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/lobby/create', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = privateLobbySettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const roomCode = generateRoomCode();
    const room = await matchMaker.createRoom('race', {
      trackId: parsed.data.trackId,
      mode: 'private',
      laps: parsed.data.laps,
      botCount: parsed.data.botCount,
      aiDifficulty: parsed.data.aiDifficulty,
      roomCode,
    });

    return reply.code(201).send({ roomId: room.roomId, roomCode });
  });

  app.get('/lobby/join/:roomCode', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = joinByCodeSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_room_code' });

    const rooms = await matchMaker.query({ name: 'race', 'metadata.roomCode': parsed.data.roomCode } as never);
    const room = rooms[0];
    if (!room) return reply.code(404).send({ error: 'room_not_found' });

    const metadata = room.metadata as { trackId?: string; laps?: number; botCount?: number; aiDifficulty?: string } | undefined;
    return reply.send({
      roomId: room.roomId,
      trackId: metadata?.trackId ?? '',
      laps: metadata?.laps ?? 3,
      botCount: metadata?.botCount ?? 0,
      aiDifficulty: metadata?.aiDifficulty ?? 'normal',
    });
  });
}
