import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'tmp', 'node_modules', 'coverage', 'scripts/cache', 'src/data/sets.generated.ts', 'fixtures'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'warn',
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      eqeqeq: 'error',
    },
  },
  { files: ['tests/**'], rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },
  prettier,
);
