/**
 * Pure helpers for sha-keyed "viewed file" review state.
 *
 * A file is considered "viewed" only while the sha it was marked viewed at
 * still matches the file's current sha in the PR. If the author pushes a change
 * to that file, its sha changes and the prior "viewed" mark becomes "stale"
 * (changed since viewed) — it must NOT count as viewed (GitHub behaviour).
 */

/** Stable key identifying a PR review session for persistence scoping. */
export function prStorageKey(
  org: string,
  repo: string,
  prNumber: number,
): string {
  return `${org}/${repo}/${prNumber}`;
}

/** Persisted per-PR record: filePath -> the file sha that was marked viewed. */
export type ViewedShaMap = Record<string, string>;

/** Current file shas for the loaded PR: filePath -> current sha. */
export type ShaByPath = Record<string, string>;

export interface ViewedMaps {
  /** path -> true when the stored sha matches the current sha (genuinely viewed). */
  viewed: Record<string, boolean>;
  /** path -> true when marked viewed but the file changed since (stale). */
  stale: Record<string, boolean>;
}

/**
 * Derive the current-PR viewed/stale boolean maps from the persisted sha map
 * and the current file shas. Paths no longer present in the PR are dropped.
 */
export function deriveViewedMaps(
  storedShas: ViewedShaMap | undefined,
  currentShas: ShaByPath,
): ViewedMaps {
  const viewed: Record<string, boolean> = {};
  const stale: Record<string, boolean> = {};
  if (!storedShas) return { viewed, stale };

  for (const [path, viewedSha] of Object.entries(storedShas)) {
    const currentSha = currentShas[path];
    if (currentSha === undefined) continue; // file no longer in PR
    if (currentSha === viewedSha) viewed[path] = true;
    else stale[path] = true;
  }
  return { viewed, stale };
}

/**
 * Evict oldest PR entries (object insertion order) beyond `max`, never removing
 * the current key. Returns the same reference when nothing needs pruning.
 */
export function pruneTrackedPrs<T>(
  byPr: Record<string, T>,
  currentKey: string,
  max: number,
): Record<string, T> {
  const keys = Object.keys(byPr);
  if (keys.length <= max) return byPr;

  const next = { ...byPr };
  for (const k of keys) {
    if (Object.keys(next).length <= max) break;
    if (k === currentKey) continue;
    delete next[k];
  }
  return next;
}
