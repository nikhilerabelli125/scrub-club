import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// docs/07 §4 is the source of truth for data shapes (CLAUDE.md golden rule 2). This
// compiles its TypeScript block next to src/data/schema.ts and checks that every type
// it declares is exactly the schema's type, so changing one without the other fails.
it('src/data/schema.ts matches the types in docs/07 §4', () => {
  const doc = readFileSync(join(root, 'docs/07-architecture.md'), 'utf8');
  const block = /## 4\. Data model[\s\S]*?```ts\n([\s\S]*?)```/.exec(doc)?.[1];
  if (!block) throw new Error('docs/07 §4 has no ```ts block');
  const names = [...block.matchAll(/^(?:type|interface)\s+(\w+)/gm)].map((match) => match[1]);
  expect(names.length).toBeGreaterThan(10);

  const source = [
    "import type * as Schema from './src/data/schema';",
    block,
    // True only when A and B are identical, not merely assignable to each other.
    'type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;',
    'type Expect<T extends true> = T;',
    ...names.map((name) => `type Check${name} = Expect<Same<${name}, Schema.${name}>>;`),
    'export {};',
  ].join('\n');

  expect(typeErrors(source)).toEqual([]);
}, 60_000);

function typeErrors(source: string): string[] {
  const config = ts.getParsedCommandLineOfConfigFile(
    join(root, 'tsconfig.sim.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
  );
  if (!config) throw new Error('could not read tsconfig.sim.json');

  const fileName = join(root, '__docs-07-types__.ts');
  const host = ts.createCompilerHost(config.options);
  const readSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...rest) =>
    name === fileName
      ? ts.createSourceFile(name, source, languageVersion)
      : readSourceFile(name, languageVersion, ...rest);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === fileName || fileExists(name);

  const program = ts.createProgram([fileName], config.options, host);
  const lines = source.split('\n');
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file?.fileName !== fileName || diagnostic.start === undefined) return message;
    const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${lines[line]?.trim() ?? ''}\n  ${message}`;
  });
}
