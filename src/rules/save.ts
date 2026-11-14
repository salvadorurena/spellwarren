import { Bank } from './bank';

/**
 * Raised whenever the saved form changes, so an older save is recognised
 * rather than misread.
 */
export const SAVE_VERSION = 1;

/** The Bank as text, ready to keep in the browser. */
export function writeSave(bank: Bank): string {
  return JSON.stringify({ version: SAVE_VERSION, ...bank.state });
}

/**
 * The Bank a save holds. With no save, a damaged one or one from another
 * version, the player starts fresh rather than seeing an error.
 */
export function readSave(text: string | null): Bank {
  if (text === null) return new Bank();
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null) return new Bank();
    const { version, gold, upgrades } = data as Record<string, unknown>;
    if (version !== SAVE_VERSION) return new Bank();
    return new Bank({
      gold: typeof gold === 'number' ? gold : 0,
      upgrades: typeof upgrades === 'object' && upgrades !== null ? upgrades : {},
    });
  } catch {
    return new Bank();
  }
}
