/**
 * @module commands/refactor/utils/summary
 * @description Summary report generation for refactor command
 */

import type { RefactorAnalysis } from '../core/types';
import type { TypecheckResult } from './typecheck';

/**
 * Print refactor summary report
 */
export function printSummaryReport(
  analysis: RefactorAnalysis,
  typecheckResult: TypecheckResult | null,
  appliedMigrations: boolean,
  appliedTypeFixes: boolean,
): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📋 REFACTOR SUMMARY REPORT');
  console.log('═'.repeat(60));

  // Analysis results
  console.log('\n📊 Analysis:');
  console.log(`   • Function duplicates found: ${analysis.duplicates.length}`);
  if (analysis.typeDuplicates) {
    console.log(`   • Type duplicates found: ${analysis.typeDuplicates.length}`);
  }
  console.log(`   • Structure score: ${analysis.structure.score}/100`);
  console.log(`   • Migration actions: ${analysis.migration.actions.length}`);

  // Applied changes
  if (appliedMigrations || appliedTypeFixes) {
    console.log('\n✅ Applied:');
    if (appliedMigrations) {
      console.log(`   • ${analysis.migration.actions.length} migration(s)`);
    }
    if (appliedTypeFixes && analysis.typeDuplicates) {
      console.log(`   • Type fixes`);
    }
  }

  // Typecheck results
  if (typecheckResult) {
    console.log('\n🔍 TypeCheck:');
    if (typecheckResult.success) {
      console.log(`   ✅ Passed (${typecheckResult.duration.toFixed(1)}s)`);
    } else {
      console.log(
        `   ❌ Failed with ${typecheckResult.errors} error(s) (${typecheckResult.duration.toFixed(1)}s)`,
      );
      // Show first few errors
      const lines = typecheckResult.output.split('\n');
      const errorLines = lines.filter((l) => l.includes('error TS')).slice(0, 5);
      if (errorLines.length > 0) {
        console.log('\n   First errors:');
        for (const line of errorLines) {
          console.log(`   ${line.trim().substring(0, 80)}`);
        }
        if (typecheckResult.errors > 5) {
          console.log(`   ... and ${typecheckResult.errors - 5} more`);
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
}
