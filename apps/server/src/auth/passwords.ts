import argon2 from 'argon2';

/** Argon2id with reasonably strong defaults (19 MiB memory would be minimal; we use
 * the library's recommended interactive parameters, tuned up slightly for a game
 * account rather than a high-QPS API). Never store or log plaintext passwords. */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
