const typescriptParser = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  { ignores: ['dist/**', '.next/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: typescriptParser, parserOptions: { projectService: true } },
    plugins: { '@typescript-eslint': typescriptPlugin },
    rules: { ...typescriptPlugin.configs.recommended.rules },
  },
];