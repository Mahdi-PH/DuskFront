import { Redis } from 'ioredis';
import { env } from './env.js';

/** Shared Redis connection used for matchmaking queue state and Colyseus presence
 * once scaled beyond a single process (see index.ts's driver setup). */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message);
});
