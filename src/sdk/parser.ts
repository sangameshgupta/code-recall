import { OBSERVATION_TYPES, type ObservationType } from '../constants/observation-metadata.js';

export interface ParsedObservation {
  type: string;
  title: string | null;
  subtitle: string | null;
  facts: string[];
  narrative: string | null;
  concepts: string[];
  files_read: string[];
  files_modified: string[];
}

export interface ParsedSummary {
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  files_read: string | null;
  files_edited: string | null;
  notes: string | null;
}

/**
 * Extract text content from an XML tag. Returns null if tag not found.
 */
function extractTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract an attribute value from a tag.
 */
function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract all items from a list-style tag (e.g., <facts><fact>...</fact></facts>)
 */
function extractList(xml: string, containerTag: string, itemTag: string): string[] {
  const container = extractTag(xml, containerTag);
  if (!container) return [];

  const regex = new RegExp(`<${itemTag}>([\\s\\S]*?)</${itemTag}>`, 'gi');
  const items: string[] = [];
  let match;
  while ((match = regex.exec(container)) !== null) {
    const item = match[1].trim();
    if (item) items.push(item);
  }
  return items;
}

/**
 * Validate observation type against known types.
 * Falls back to first type if unknown (never skip observations).
 */
function validateType(type: string | null): string {
  if (!type) return OBSERVATION_TYPES[0];
  const normalized = type.toLowerCase().trim();
  if ((OBSERVATION_TYPES as readonly string[]).includes(normalized)) return normalized;
  return OBSERVATION_TYPES[0]; // Fallback — ALWAYS save
}

/**
 * Parse observation blocks from SDK agent response text.
 * Uses regex-based extraction (not DOM parser) for robustness with LLM output.
 *
 * Expected format:
 * <observation type="feature">
 *   <title>...</title>
 *   <subtitle>...</subtitle>
 *   <narrative>...</narrative>
 *   <facts><fact>...</fact></facts>
 *   <concepts><concept>...</concept></concepts>
 *   <files_read><file>...</file></files_read>
 *   <files_modified><file>...</file></files_modified>
 * </observation>
 */
export function parseObservations(text: string): ParsedObservation[] {
  if (!text) return [];

  const observations: ParsedObservation[] = [];
  const obsRegex = /<observation[^>]*>([\s\S]*?)<\/observation>/gi;
  let match;

  while ((match = obsRegex.exec(text)) !== null) {
    const block = match[0];
    const inner = match[1];

    const type = extractAttribute(block, 'observation', 'type');
    const title = extractTag(inner, 'title');
    const subtitle = extractTag(inner, 'subtitle');
    const narrative = extractTag(inner, 'narrative');
    const facts = extractList(inner, 'facts', 'fact');
    const concepts = extractList(inner, 'concepts', 'concept');
    const filesRead = extractList(inner, 'files_read', 'file');
    const filesModified = extractList(inner, 'files_modified', 'file');

    observations.push({
      type: validateType(type),
      title,
      subtitle,
      narrative,
      facts,
      concepts,
      files_read: filesRead,
      files_modified: filesModified,
    });
  }

  return observations;
}

/**
 * Parse a summary block from SDK agent response text.
 *
 * Expected format:
 * <summary>
 *   <request>...</request>
 *   <investigated>...</investigated>
 *   <learned>...</learned>
 *   <completed>...</completed>
 *   <next_steps>...</next_steps>
 *   <files_read>...</files_read>
 *   <files_edited>...</files_edited>
 *   <notes>...</notes>
 * </summary>
 */
export function parseSummary(text: string): ParsedSummary | null {
  if (!text) return null;

  const summaryBlock = extractTag(text, 'summary');
  if (!summaryBlock) return null;

  return {
    request: extractTag(summaryBlock, 'request'),
    investigated: extractTag(summaryBlock, 'investigated'),
    learned: extractTag(summaryBlock, 'learned'),
    completed: extractTag(summaryBlock, 'completed'),
    next_steps: extractTag(summaryBlock, 'next_steps'),
    files_read: extractTag(summaryBlock, 'files_read'),
    files_edited: extractTag(summaryBlock, 'files_edited'),
    notes: extractTag(summaryBlock, 'notes'),
  };
}
