/**
 * Example: How to integrate import-graph-swc into the context command
 *
 * This shows how to add import graph analysis to the context XML output.
 */

import {
  buildImportGraphSwc,
  filterGraphByPatterns,
  formatImportGraphAscii,
  getGraphStats,
} from './src/commands/context/parsers';
import type { ImportGraph } from './src/commands/context/parsers';

/**
 * Generate import graph section for context XML
 */
function formatImportGraphXml(graph: ImportGraph): string {
  const stats = getGraphStats(graph);
  const tree = formatImportGraphAscii(graph, { maxDepth: 2, showImportedBy: false });

  let xml = '<imports>\n';
  xml += '  <summary>\n';
  xml += `    <total-files>${stats.totalFiles}</total-files>\n`;
  xml += `    <total-imports>${stats.totalImports}</total-imports>\n`;
  xml += `    <avg-imports>${stats.avgImportsPerFile.toFixed(2)}</avg-imports>\n`;
  xml += `    <circular-dependencies>${stats.circularDependencies}</circular-dependencies>\n`;
  xml += '  </summary>\n';

  // Circular dependencies warning
  if (graph.circular.length > 0) {
    xml += '  <circular-dependencies>\n';
    for (const cycle of graph.circular) {
      xml += `    <cycle>${cycle.join(' → ')}</cycle>\n`;
    }
    xml += '  </circular-dependencies>\n';
  }

  // Most imported files (potential shared utilities)
  if (stats.mostImported.count > 0) {
    xml += '  <key-files>\n';
    xml += `    <most-imported file="${stats.mostImported.file}" count="${stats.mostImported.count}"/>\n`;
    xml += `    <most-imports file="${stats.maxImports.file}" count="${stats.maxImports.count}"/>\n`;
    xml += '  </key-files>\n';
  }

  // ASCII tree
  xml += '  <dependency-tree>\n';
  xml += tree
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
  xml += '\n  </dependency-tree>\n';
  xml += '</imports>\n';

  return xml;
}

/**
 * Example: Add to context command
 */
function exampleUsage() {
  console.log('Example: Integrating import graph into context command\n');

  // 1. Build graph for a feature
  const featureDir = './src/commands/context/parsers';
  const featureName = 'swc';

  console.log(`Analyzing imports in ${featureDir}...`);
  const fullGraph = buildImportGraphSwc(featureDir, []);
  const filteredGraph = filterGraphByPatterns(fullGraph, [featureName]);

  // 2. Generate XML
  const xml = formatImportGraphXml(filteredGraph);
  console.log('\nGenerated XML:\n');
  console.log(xml);

  // 3. Mermaid diagram for documentation
  console.log('\nMermaid Diagram:\n');
  const mermaid = formatImportGraphAscii(filteredGraph, { mermaid: true });
  console.log(mermaid);

  // 4. Statistics
  console.log('\nStatistics:');
  const stats = getGraphStats(filteredGraph);
  console.log(`  Total files: ${stats.totalFiles}`);
  console.log(`  Total imports: ${stats.totalImports}`);
  console.log(`  Avg imports/file: ${stats.avgImportsPerFile.toFixed(2)}`);
  console.log(`  Circular deps: ${stats.circularDependencies}`);
  if (stats.mostImported.count > 0) {
    console.log(`  Most imported: ${stats.mostImported.file} (${stats.mostImported.count} times)`);
  }
}

/**
 * Example: Detect cross-feature dependencies
 */
function detectCrossFeatureDeps() {
  console.log('\n='.repeat(60));
  console.log('Example: Detecting cross-feature dependencies\n');

  const graph = buildImportGraphSwc('./src/commands', []);

  // Group by feature (directory)
  const featureDeps = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    const parts = node.file.split('/');
    const feature = parts[0] || 'root';

    if (!featureDeps.has(feature)) {
      featureDeps.set(feature, new Set());
    }

    // Check imports from other features
    for (const imp of node.imports) {
      const impParts = imp.split('/');
      const impFeature = impParts[0] || 'root';

      if (impFeature !== feature && impFeature !== '..') {
        featureDeps.get(feature)!.add(impFeature);
      }
    }
  }

  // Report
  console.log('Cross-feature dependencies:');
  for (const [feature, deps] of Array.from(featureDeps.entries())) {
    if (deps.size > 0) {
      console.log(`  ${feature} → ${Array.from(deps).join(', ')}`);
    }
  }
}

/**
 * Example: Find isolated modules (good for extraction)
 */
function findIsolatedModules() {
  console.log('\n='.repeat(60));
  console.log('Example: Finding isolated modules\n');

  const graph = buildImportGraphSwc('./src/commands/context/parsers', []);

  // Files that import nothing or only types.ts
  const isolated = graph.nodes.filter((node) => {
    if (node.imports.length === 0) return true;
    if (node.imports.length === 1 && node.imports[0]?.includes('types.ts')) return true;
    return false;
  });

  console.log('Isolated modules (easy to extract):');
  for (const node of isolated) {
    console.log(`  ${node.file} (imported by ${node.importedBy.length} files)`);
  }
}

// Run examples
if (require.main === module) {
  exampleUsage();
  detectCrossFeatureDeps();
  findIsolatedModules();
}

export { formatImportGraphXml, exampleUsage, detectCrossFeatureDeps, findIsolatedModules };
