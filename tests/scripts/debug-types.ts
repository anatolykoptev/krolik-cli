import * as fs from 'node:fs';
import { getNodeSpan, getNodeText, parseFile, visitNodeWithCallbacks } from './src/lib/@swc';

const content = `export interface User {
  id: string;
  items: string[];
  role: 'admin' | 'user';
}`;

console.log('Content:', JSON.stringify(content));
console.log('Content length:', content.length);
console.log();

const { ast } = parseFile('test.ts', content);

visitNodeWithCallbacks(ast, {
  onTsPropertySignature: (node) => {
    const propNode = node as any;
    const typeAnn = propNode.typeAnnotation?.typeAnnotation;

    console.log('Key:', propNode.key?.value);
    console.log('Type:', typeAnn?.type);
    console.log('Kind:', typeAnn?.kind);
    console.log('Type annotation span:', typeAnn?.span);

    if (typeAnn?.span) {
      const start = typeAnn.span.start;
      const end = typeAnn.span.end;
      const text = content.slice(start, end);
      console.log(`Text at [${start}:${end}]:`, JSON.stringify(text));

      // Try offsetting by -1
      const textMinus1 = content.slice(start - 1, end - 1);
      console.log(`Text at [${start - 1}:${end - 1}] (offset -1):`, JSON.stringify(textMinus1));
    }

    console.log('\n---\n');
  },
});
