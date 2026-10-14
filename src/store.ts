import { useSyncExternalStore } from "react";
import type { AccountKey } from "./crypto";
import type { LessonId } from "./curriculum";
import { createGenesis, fundLearner, type Ledger } from "./ledger";

export type Progress = Record<LessonId, Record<string, boolean>>;

type Persisted = {
  progress: Progress;
  account: AccountKey | null;
  ledger: Ledger;
  revokedCredentialIds: string[];
};

const STORAGE_KEY = "web3-learning-v1";

const emptyProgress = (): Progress => ({
  hash: {},
  ca: {},
  address: {},
  merkle: {},
  tx: {},
  contract: {},
  vc: {},
});

function fresh(): Persisted {
  return {
    progress: emptyProgress(),
    account: null,
    ledger: createGenesis(),
    revokedCredentialIds: [],
  };
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed.ledger?.blocks || !parsed.progress) return fresh();
    return {
      progress: { ...emptyProgress(), ...parsed.progress },
      account: parsed.account,
      ledger: parsed.ledger,
      revokedCredentialIds: parsed.revokedCredentialIds ?? [],
    };
  } catch {
    return fresh();
  }
}

let state: Persisted = load();
const listeners = new Set<() => void>();

function commit(next: Persisted) {
  state = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export function getState(): Persisted {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(): Persisted {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function markCheck(lesson: LessonId, check: string) {
  if (state.progress[lesson]?.[check]) return;
  commit({
    ...state,
    progress: {
      ...state.progress,
      [lesson]: { ...state.progress[lesson], [check]: true },
    },
  });
}

export function saveAccount(account: AccountKey) {
  commit({
    ...state,
    account,
    ledger: fundLearner(state.ledger, account),
  });
}

export function saveLedger(ledger: Ledger) {
  commit({ ...state, ledger });
}

export function revokeCredential(id: string) {
  if (state.revokedCredentialIds.includes(id)) return;
  commit({ ...state, revokedCredentialIds: [...state.revokedCredentialIds, id] });
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  commit(fresh());
}
