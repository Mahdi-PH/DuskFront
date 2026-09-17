import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { env } from './env.js';
import { registerAuthRoutes } from './auth/authRoutes.js';
import { registerProfileRoutes } from './api/profileRoutes.js';
import { registerLeaderboardRoutes } from './api/leaderboardRoutes.js';
import { registerFriendsRoutes } from './api/friendsRoutes.js';
import { registerMissionsRoutes } from './api/missionsRoutes.js';
import { registerLobbyRoutes } from './api/lobbyRoutes.js';
import { registerAchievementsRoutes } from './api/achievementsRoutes.js';
import { RaceRoom } from './rooms/RaceRoom.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.get('/health', async () => ({ ok: true, service: 'velocity-island-server' }));

  await registerAuthRoutes(app);
  await registerProfileRoutes(app);
  await registerLeaderboardRoutes(app);
  await registerFriendsRoutes(app);
  await registerMissionsRoutes(app);
  await registerLobbyRoutes(app);
  await registerAchievementsRoutes(app);

  await app.ready();

  const gameServer = new Server({
    transport: new WebSocketTransport({ server: app.server }),
    presence: new RedisPresence(env.REDIS_URL),
    driver: new RedisDriver(env.REDIS_URL),
  });

  gameServer.define('race', RaceRoom).filterBy(['trackId', 'mode']);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Velocity Island server listening on :${env.PORT} (${env.NODE_ENV})`);
}

main().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
