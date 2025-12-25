import { detectMonorepo } from './src/lib/@discovery';
import { detectLibraries } from './src/lib/@docs-cache';

const projectRoot = '/Users/anatoliikoptev/CascadeProjects/piternow_project/piternow-wt-fix';

console.log('=== Monorepo Detection ===');
const monorepo = detectMonorepo(projectRoot);
console.log(JSON.stringify(monorepo, null, 2));

console.log('\n=== Libraries Detection ===');
const libs = detectLibraries(projectRoot);
console.log(JSON.stringify(libs, null, 2));
