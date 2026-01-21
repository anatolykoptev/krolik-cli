import { resolvePrdPath } from './dist/lib/@felix/orchestrator/config-resolver.js';

const projectRoot = process.cwd();

try {
  const result = resolvePrdPath({
    projectRoot,
    prdPath: 'PRD-prd-generator.json', // Invalid - not in .krolik/felix/prd/
    model: 'sonnet',
    backend: 'cli',
    maxAttempts: 3,
    maxCostUsd: 10,
    validationSteps: [],
    continueOnFailure: false,
    onEvent: () => {},
    onCostUpdate: () => {},
    plugins: [],
    enableContext: true,
    enableGitAutoCommit: false,
    qualityGateMode: 'pre-commit',
    enableMemory: true,
    dryRun: false,
    verbose: false,
    enableParallelExecution: false,
    maxParallelTasks: 3,
    enableCheckpoints: true,
    useMultiAgentMode: false,
  });
  console.log('❌ FAIL: Should have thrown an error');
  console.log('Got:', result);
  process.exit(1);
} catch (error) {
  console.log('✅ SUCCESS: Validation caught invalid path\n');
  console.log('Error message:');
  console.log(error.message);
  process.exit(0);
}
