/**
 * Test script for import-graph-swc.ts
 * Run with: npx tsx test-import-graph.ts
 */

import {
  buildImportGraphSwc,
  formatImportGraphAscii,
  filterGraphByPatterns,
  getGraphStats,
} from './src/commands/context/parsers/import-graph-swc';

// Test 1: Build graph for context parsers
console.log('='.repeat(60));
console.log('Test 1: Analyzing context/parsers directory');
console.log('='.repeat(60));

const graph = buildImportGraphSwc('./src/commands/context/parsers', []);
console.log(formatImportGraphAscii(graph, { maxDepth: 2, showImportedBy: true }));

// Test 2: Get statistics
console.log('\n' + '='.repeat(60));
console.log('Test 2: Graph statistics');
console.log('='.repeat(60));

const stats = getGraphStats(graph);
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Total imports: ${stats.totalImports}`);
console.log(`Average imports per file: ${stats.avgImportsPerFile.toFixed(2)}`);
console.log(`Circular dependencies: ${stats.circularDependencies}`);
console.log(`Most imports: ${stats.maxImports.file} (${stats.maxImports.count})`);
console.log(`Most imported: ${stats.mostImported.file} (${stats.mostImported.count})`);

// Test 3: Filter by pattern
console.log('\n' + '='.repeat(60));
console.log('Test 3: Filter by pattern (swc)');
console.log('='.repeat(60));

const filteredGraph = filterGraphByPatterns(graph, ['swc']);
console.log(formatImportGraphAscii(filteredGraph, { maxDepth: 3 }));

// Test 4: Mermaid output
console.log('\n' + '='.repeat(60));
console.log('Test 4: Mermaid diagram');
console.log('='.repeat(60));

console.log(formatImportGraphAscii(filteredGraph, { mermaid: true }));
