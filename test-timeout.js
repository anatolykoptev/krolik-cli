const { detectHardcodedSwc } = require('./dist/bin/cli.js');

const content = `const timeout = 5000;
const delay = 3000;
const myTimeout = 2000;`;

console.log('Content:');
console.log(content);
console.log('');

const result = detectHardcodedSwc(content, 'test.ts');
console.log('Results:');
result.forEach((r, i) => {
  console.log(`  ${i}: value=${r.value}, context="${r.context}"`);
});
