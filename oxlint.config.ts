import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: [
    'typescript',
    'unicorn',
    'oxc',
    'react',
    'import',
    'promise',
    'vitest',
  ],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'warn',
  },
  rules: {
    // The new JSX transform (`jsx: react-jsx`) does not need React in scope.
    'react/react-in-jsx-scope': 'off',
    // Queue messages are sent sequentially on purpose.
    'eslint/no-await-in-loop': 'off',
    // `vi.fn()` infers its signature from the implementation.
    'vitest/require-mock-type-parameters': 'off',
  },
  env: {
    builtin: true,
  },
  ignorePatterns: ['dist', 'coverage', '**/__snapshots__/**'],
})
