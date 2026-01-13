/**
 * @module commands/context/formatters/ai/sections/details/info
 * @description Memory and LibraryDocs section formatters
 */

import type { AiContextData } from '../../../../types';
import { escapeXml, MAX_ITEMS_SMALL, MAX_MEMORY_ITEMS } from '../../helpers';

/** Type abbreviations for compact memory output */
const TYPE_ABBREV: Record<string, string> = {
  decision: 'DEC',
  pattern: 'PAT',
  bugfix: 'BUG',
  observation: 'OBS',
  feature: 'FEAT',
};

/**
 * Format memory section (knowledge from previous sessions)
 * Compact format: ~300 tokens vs ~1000 tokens (70% reduction)
 */
export function formatMemorySection(lines: string[], data: AiContextData): void {
  const { memories } = data;
  if (!memories || memories.length === 0) return;

  const displayMemories = memories.slice(0, MAX_MEMORY_ITEMS);

  lines.push(`  <memory n="${displayMemories.length}" hint="krolik_mem_search for details">`);

  for (const mem of displayMemories) {
    const typeAbbrev = TYPE_ABBREV[mem.type] ?? mem.type.toUpperCase().slice(0, 3);
    const tags = mem.tags?.length ? ` [${mem.tags.slice(0, 2).join(',')}]` : '';
    lines.push(`    <m t="${typeAbbrev}">${escapeXml(mem.title)}${tags}</m>`);
  }

  if (memories.length > MAX_MEMORY_ITEMS) {
    lines.push(`    <!-- +${memories.length - MAX_MEMORY_ITEMS} more -->`);
  }

  lines.push('  </memory>');
}

/**
 * Check if a library section is relevant to the given domains
 */
function isRelevantToContext(
  section: { title: string; content: string },
  domains: string[],
): boolean {
  if (domains.length === 0) return true;
  const text = `${section.title} ${section.content}`.toLowerCase();
  return domains.some((d) => text.includes(d.toLowerCase()));
}

/**
 * Filter library sections to only include domain-relevant ones
 */
function filterRelevantSections(
  sections: { title: string; content: string; codeSnippets: string[] }[],
  domains: string[],
): { title: string; content: string; codeSnippets: string[] }[] {
  if (domains.length === 0) return sections;
  return sections.filter((section) => isRelevantToContext(section, domains));
}

/**
 * Format code snippet for library documentation
 */
function formatCodeSnippet(lines: string[], snippet: string): void {
  lines.push('        <code>');
  lines.push(`          ${escapeXml(snippet.slice(0, 300))}`);
  if (snippet.length > 300) {
    lines.push('          <!-- truncated -->');
  }
  lines.push('        </code>');
}

/**
 * Format a single library section
 */
function formatLibrarySection(
  lines: string[],
  section: { title: string; content: string; codeSnippets: string[] },
): void {
  lines.push(`      <section title="${escapeXml(section.title)}">`);
  lines.push(`        <content>${escapeXml(section.content)}</content>`);

  for (const snippet of section.codeSnippets.slice(0, 2)) {
    formatCodeSnippet(lines, snippet);
  }

  lines.push('      </section>');
}

/**
 * Format a single library entry
 */
function formatLibraryEntry(
  lines: string[],
  lib: {
    libraryName: string;
    libraryId: string;
    sections: { title: string; content: string; codeSnippets: string[] }[];
  },
): void {
  lines.push(`    <library name="${lib.libraryName}" id="${lib.libraryId}">`);

  for (const section of lib.sections.slice(0, MAX_ITEMS_SMALL)) {
    formatLibrarySection(lines, section);
  }

  if (lib.sections.length > MAX_ITEMS_SMALL) {
    lines.push(`      <!-- +${lib.sections.length - MAX_ITEMS_SMALL} more sections -->`);
  }

  lines.push('    </library>');
}

/**
 * Format library documentation section (from Context7)
 * Filters sections based on domain relevance
 */
export function formatLibraryDocsSection(lines: string[], data: AiContextData): void {
  const { libraryDocs } = data;
  if (!libraryDocs || libraryDocs.length === 0) return;

  const domains = data.context.domains || [];
  const availableLibraries: string[] = [];
  const relevantLibraries: Array<{
    libraryName: string;
    libraryId: string;
    sections: { title: string; content: string; codeSnippets: string[] }[];
  }> = [];

  for (const lib of libraryDocs) {
    if (lib.sections.length === 0) continue;

    availableLibraries.push(lib.libraryName);
    const relevantSections = filterRelevantSections(lib.sections, domains);

    if (relevantSections.length > 0) {
      relevantLibraries.push({
        libraryName: lib.libraryName,
        libraryId: lib.libraryId,
        sections: relevantSections,
      });
    }
  }

  if (relevantLibraries.length === 0) {
    if (availableLibraries.length > 0 && domains.length > 0) {
      lines.push('  <library-docs hint="No domain-specific docs found">');
      lines.push(`    <available>${availableLibraries.join(', ')}</available>`);
      lines.push('    <tip>Use "krolik docs search {domain}" to find relevant docs</tip>');
      lines.push('  </library-docs>');
    }
    return;
  }

  lines.push('  <library-docs hint="Auto-fetched from Context7 - domain-relevant documentation">');

  for (const lib of relevantLibraries) {
    formatLibraryEntry(lines, lib);
  }

  lines.push('    <hint>Use "krolik docs search {query}" to find more documentation</hint>');
  lines.push('  </library-docs>');
}
