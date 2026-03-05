import type { CodeRecallDatabase } from './Database.js';
import type { ObservationsStore } from './Observations.js';
import type { SummariesStore } from './Summaries.js';
import type { PendingMessageStore } from './PendingMessageStore.js';

/**
 * Atomic 3-step operation:
 * 1. Insert observations
 * 2. Mark pending_message as processed
 * 3. FTS5 sync (handled by DB triggers)
 */
export function storeObservationsAndMarkComplete(
  db: CodeRecallDatabase,
  observations: ObservationsStore,
  pendingMessages: PendingMessageStore,
  messageId: number,
  parsedObservations: Array<{
    memorySessionId: string;
    project: string;
    text: string;
    type: string;
    title?: string;
    subtitle?: string;
    narrative?: string;
    facts?: string[];
    concepts?: string[];
    filesRead?: string[];
    filesModified?: string[];
  }>
): number[] {
  const insertedIds: number[] = [];

  db.transaction(() => {
    for (const obs of parsedObservations) {
      const id = observations.insert(obs);
      if (id !== null) {
        insertedIds.push(id);
      }
    }

    // Mark the pending message as processed (even if all observations were duplicates)
    pendingMessages.confirm(messageId);
  });

  return insertedIds;
}

/**
 * Store a session summary atomically with message confirmation
 */
export function storeSummaryAndMarkComplete(
  db: CodeRecallDatabase,
  summaries: SummariesStore,
  pendingMessages: PendingMessageStore,
  messageId: number,
  summary: {
    memorySessionId: string;
    project: string;
    request?: string;
    investigated?: string;
    learned?: string;
    completed?: string;
    nextSteps?: string;
    filesRead?: string;
    filesEdited?: string;
    notes?: string;
  }
): number {
  let summaryId = 0;

  db.transaction(() => {
    summaryId = summaries.insert(summary);
    pendingMessages.confirm(messageId);
  });

  return summaryId;
}
