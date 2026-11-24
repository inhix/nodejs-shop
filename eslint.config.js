import { createBaseConfig } from '@shop/config-eslint';

// Lints root-level files only; each workspace package has its own eslint.config.js.
export default [{ ignores: ['apps/**', 'packages/**'] }, ...createBaseConfig(import.meta.dirname)];
