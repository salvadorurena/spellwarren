import type { Bank } from './rules/bank';
import { readSave, writeSave } from './rules/save';

/** Where the browser keeps the save. */
const SAVE_KEY = 'spellwarren-save';

/**
 * Opens the Bank saved in this browser, or a fresh one, and saves it again
 * after every change. Browser storage can be missing or refused (in a
 * private window, say), in which case the game still plays but forgets
 * everything when the tab closes.
 */
export function openSavedBank(): Bank {
  const bank = readSave(readStorage());
  bank.onChange(() => writeStorage(writeSave(bank)));
  return bank;
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(text: string): void {
  try {
    window.localStorage.setItem(SAVE_KEY, text);
  } catch {
    // Nowhere to save; the Bank lives on in memory for this visit.
  }
}
