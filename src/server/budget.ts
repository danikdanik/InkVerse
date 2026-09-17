/**
 * Per-provider spend ledger. reserve() before dispatch, reconcile() after.
 * available = cap - actual - reserved. Hard stop (budget_exhausted) when nothing is available.
 * Unknown costs increment unknownCount and are never silently treated as $0.
 */
import type { BudgetLedger } from '@shared/schemas';

export type BudgetProvider = 'anthropic' | 'runware';

export class BudgetExhaustedError extends Error {
  constructor(public provider: BudgetProvider) {
    super('budget_exhausted');
    this.name = 'BudgetExhaustedError';
  }
}

export function freshLedger(anthropicCap: number, runwareCap: number): BudgetLedger {
  return {
    anthropic: { capUsd: anthropicCap, actualUsd: 0, reservedUsd: 0, unknownCount: 0 },
    runware: { capUsd: runwareCap, actualUsd: 0, reservedUsd: 0, unknownCount: 0 },
  };
}

/** Operates in-place on a run's BudgetLedger. Caller persists + emits after mutations. */
export class Budget {
  constructor(public ledger: BudgetLedger) {}

  available(provider: BudgetProvider): number {
    const p = this.ledger[provider];
    return p.capUsd - p.actualUsd - p.reservedUsd;
  }

  /** Reserve estimated cost. Throws BudgetExhaustedError when nothing is available. */
  reserve(provider: BudgetProvider, estimate: number | null): { reserved: number } {
    if (this.available(provider) <= 0) throw new BudgetExhaustedError(provider);
    const p = this.ledger[provider];
    // Unknown estimate: reserve nothing but remember it is unknown, not $0.
    const reserved = estimate ?? 0;
    p.reservedUsd += reserved;
    if (estimate === null) p.unknownCount += 1;
    return { reserved };
  }

  /** Release the reservation and book actual spend. null actual counts toward unknownCount. */
  reconcile(provider: BudgetProvider, reserved: number, actual: number | null): void {
    const p = this.ledger[provider];
    p.reservedUsd = Math.max(0, p.reservedUsd - reserved);
    if (actual === null) {
      p.unknownCount += 1;
      return;
    }
    p.actualUsd += actual;
  }

  snapshot(): BudgetLedger {
    return structuredClone(this.ledger);
  }
}
