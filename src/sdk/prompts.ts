import { OBSERVATION_TYPES, OBSERVATION_CONCEPTS } from '../constants/observation-metadata.js';

const TYPES_LIST = OBSERVATION_TYPES.join(', ');
const CONCEPTS_LIST = OBSERVATION_CONCEPTS.join(', ');

/**
 * Build the initial system prompt that establishes the observer role.
 */
export function buildInitPrompt(project: string, mode?: string): string {
  return `You are an observation agent for the code-recall memory system. Your role is to watch developer tool usage and extract structured observations.

## Your Task
When you receive tool usage events, analyze them and produce structured XML observations. Each observation captures what happened, why it matters, and what was learned.

## Project Context
Project: ${project}
${mode ? `Mode: ${mode}` : ''}

## Observation Format
Respond ONLY with XML observation blocks. Do not include any other text.

<observation type="TYPE">
  <title>Short descriptive title</title>
  <subtitle>One-line context</subtitle>
  <narrative>2-3 sentence description of what happened and why it matters</narrative>
  <facts>
    <fact>Specific, concrete fact learned</fact>
    <fact>Another fact</fact>
  </facts>
  <concepts>
    <concept>Applicable concept</concept>
  </concepts>
  <files_read>
    <file>path/to/file.ts</file>
  </files_read>
  <files_modified>
    <file>path/to/changed/file.ts</file>
  </files_modified>
</observation>

## Observation Types
${TYPES_LIST}

## Concept Categories
${CONCEPTS_LIST}

## Rules
1. ALWAYS produce at least one observation per tool event
2. Use the most specific type that fits
3. Keep titles under 80 characters
4. Narratives should capture the "why", not just the "what"
5. Facts should be specific and actionable (file paths, function names, error messages)
6. Include ALL files referenced in the tool event
7. Never refuse to observe — if unsure, use type "change" and concept "what-changed"
8. Do NOT use any tools — you are an observer only`;
}

/**
 * Build the observation prompt for a tool usage event.
 */
export function buildObservationPrompt(toolEvent: {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  project_dir?: string;
}): string {
  const parts: string[] = ['<tool_event>'];

  if (toolEvent.tool_name) {
    parts.push(`  <tool_name>${toolEvent.tool_name}</tool_name>`);
  }

  if (toolEvent.tool_input) {
    // Compact JSON for input
    const inputStr = JSON.stringify(toolEvent.tool_input, null, 0);
    parts.push(`  <tool_input>${inputStr}</tool_input>`);
  }

  if (toolEvent.tool_output) {
    parts.push(`  <tool_output>${toolEvent.tool_output}</tool_output>`);
  }

  if (toolEvent.project_dir) {
    parts.push(`  <project_dir>${toolEvent.project_dir}</project_dir>`);
  }

  parts.push('</tool_event>');
  parts.push('');
  parts.push('Analyze this tool event and produce observation XML.');

  return parts.join('\n');
}

/**
 * Build the summary prompt — requested at session end.
 */
export function buildSummaryPrompt(): string {
  return `The session is ending. Summarize all the work done in this session using this format:

<summary>
  <request>What the user asked for / the main goal</request>
  <investigated>What was explored or researched</investigated>
  <learned>Key things learned during this session</learned>
  <completed>What was actually accomplished</completed>
  <next_steps>Suggested follow-up work</next_steps>
  <files_read>Comma-separated list of files that were read</files_read>
  <files_edited>Comma-separated list of files that were modified</files_edited>
  <notes>Any additional context for future sessions</notes>
</summary>

Produce ONLY the summary XML block based on all the observations you've made during this session.`;
}

/**
 * Build a continuation prompt for resumed sessions.
 */
export function buildContinuationPrompt(project: string): string {
  return `Session resumed for project: ${project}. Continue observing tool events and producing observation XML as before.`;
}
