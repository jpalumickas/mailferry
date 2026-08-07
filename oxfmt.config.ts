import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 80,
  semi: false,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'es5',
  tabWidth: 2,
  useTabs: false,
  sortPackageJson: false,
  ignorePatterns: ['**/__snapshots__/**'],
})
