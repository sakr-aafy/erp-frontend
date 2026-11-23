// @ts-check
import js from '@eslint/js';
import angular from 'angular-eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** ESLint (flat config) : TypeScript + gabarits Angular. Règles de correction et d'accessibilité en erreur ; style laissé à l'éditeur. */
export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/component-class-suffix': 'off', // pages nommées par leur rôle (Dashboard, ReportView…)
      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/no-input-rename': 'off', // alias volontaire : liaison des paramètres de route (withComponentInputBinding)
      '@angular-eslint/use-lifecycle-interface': 'off', // ngOnInit sans « implements OnInit » : convention du projet
      '@angular-eslint/no-empty-lifecycle-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // DTO d'API souples dans les écrans génériques
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
