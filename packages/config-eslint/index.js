import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Files whose tooling requires a default export (config files, Next.js routes, etc.). */
const DEFAULT_EXPORT_ALLOWED = [
  '**/eslint.config.{js,mjs,cjs,ts,mts}',
  '**/vitest.config.{js,mjs,ts,mts}',
];

/**
 * Shared, type-aware ESLint config. Enforces the code conventions in CLAUDE.md.
 *
 * @param {string} tsconfigRootDir Absolute path of the package root; pass `import.meta.dirname`.
 */
export function createBaseConfig(tsconfigRootDir) {
  return defineConfig(
    { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/.turbo/**'] },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        // TypeScript reports undefined variables itself; the core rule misreports globals.
        'no-undef': 'off',
        // Already in strictTypeChecked; listed explicitly because CLAUDE.md requires them.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
        ],
        // Disable per line with a reason: `// eslint-disable-next-line ... -- why it is safe`.
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        // NestJS modules are classes that only carry a decorator.
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
        // Named exports only.
        'no-restricted-exports': [
          'error',
          {
            restrictDefaultExports: {
              direct: true,
              named: true,
              defaultFrom: true,
              namedFrom: true,
              namespaceFrom: true,
            },
          },
        ],
      },
    },
    {
      files: DEFAULT_EXPORT_ALLOWED,
      rules: { 'no-restricted-exports': 'off' },
    },
    prettier,
  );
}
