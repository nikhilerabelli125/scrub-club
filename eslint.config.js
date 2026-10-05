import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

// Pure folders run in Node tests and, later, on an online host (docs/07 §3), so the
// golden rules in CLAUDE.md are enforced here instead of left to code review.
const PURE_FOLDERS = ['src/sim/**', 'src/minigames/**', 'src/data/**'];

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'reference/']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: PURE_FOLDERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(three|tone)(/|$)',
              message: 'Sim code never imports Three.js or Tone.js (CLAUDE.md golden rule 1).',
            },
            {
              regex: '^@dimforge/',
              message:
                'Rapier runs on the render side and reports back as sim events (docs/07 §8).',
            },
            {
              regex: '^(\\.{1,2}/)+(app|audio|debug|input|physics|render|save|ui)(/|$)',
              message:
                'Pure code may only import from src/sim, src/minigames, and src/data. Put shared types in src/sim/types.ts.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG in src/sim/rng.ts (CLAUDE.md golden rule 4).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Sim time comes from the fixed-step clock so runs replay exactly (docs/07 §3).',
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
]);
