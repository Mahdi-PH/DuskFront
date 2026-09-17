import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

/** Fastify preHandler: verifies the `Authorization: Bearer <accessToken>` header and
 * attaches `request.userId`. Rejects with 401 on any missing/invalid/expired token —
 * the server never trusts a client-supplied user id from the request body. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing_token' });
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    request.userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: 'invalid_token' });
  }
}
