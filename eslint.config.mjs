import baseConfig from './configs/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/scratch/**',
      '**/.reference-repos/**',
      '**/coverage/**',
      'pnpm-lock.yaml'
    ]
  }
];
