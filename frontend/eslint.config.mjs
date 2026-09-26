import baseConfig from '../configs/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'next-env.d.ts'
    ]
  }
];
