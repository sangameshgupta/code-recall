/** 6 Observation types */
export const OBSERVATION_TYPES = [
  'bugfix',
  'feature',
  'refactor',
  'change',
  'discovery',
  'decision',
] as const;

export type ObservationType = typeof OBSERVATION_TYPES[number];

/** 7 Observation concepts */
export const OBSERVATION_CONCEPTS = [
  'how-it-works',
  'why-it-exists',
  'what-changed',
  'problem-solution',
  'gotcha',
  'pattern',
  'trade-off',
] as const;

export type ObservationConcept = typeof OBSERVATION_CONCEPTS[number];

/** Type display metadata */
export const TYPE_METADATA: Record<ObservationType, { emoji: string; workEmoji: string; description: string }> = {
  bugfix:    { emoji: '🔴', workEmoji: '🛠️', description: 'Something was broken, now fixed' },
  feature:   { emoji: '🟣', workEmoji: '🛠️', description: 'New capability or functionality added' },
  refactor:  { emoji: '🔄', workEmoji: '🛠️', description: 'Code restructured, behavior unchanged' },
  change:    { emoji: '✅', workEmoji: '🛠️', description: 'Generic modification (docs, config, misc)' },
  discovery: { emoji: '🔵', workEmoji: '🔍', description: 'Learning about existing system' },
  decision:  { emoji: '⚖️', workEmoji: '⚖️', description: 'Architectural/design choice with rationale' },
};
