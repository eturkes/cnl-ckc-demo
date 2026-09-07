// SEED. Japanese catalog, not yet written: every key resolves to the English
// bundle so the tree compiles and every consumer can be rewired against the real
// key set. `pnpm copy:check` reports each key as untranslated until it is replaced
// by a `JA` record of its own.

import { EN, type Messages } from './en.js';

export const JA: Messages = EN;
