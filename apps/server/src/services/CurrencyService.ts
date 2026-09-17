import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

/** Credits (or debits) SPEED COINS through an append-only ledger with a caller-supplied
 * idempotency key, so retried requests (flaky network, duplicate race-result submits)
 * can never double-credit a reward — the unique constraint on idempotencyKey makes the
 * second insert fail harmlessly inside the same transaction. */
export async function creditCurrency(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  reason: string,
  idempotencyKey: string,
): Promise<{ applied: boolean }> {
  const existing = await tx.currencyLedgerEntry.findUnique({ where: { idempotencyKey } });
  if (existing) return { applied: false };

  await tx.currencyLedgerEntry.create({ data: { userId, amount, reason, idempotencyKey } });
  await tx.profile.update({ where: { userId }, data: { coins: { increment: amount } } });
  return { applied: true };
}

export async function getCurrencyBalance(userId: string): Promise<number> {
  const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } });
  return profile.coins;
}
