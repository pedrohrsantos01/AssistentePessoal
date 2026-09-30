import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', 'src/core/sync/generated/**', 'drizzle/**', '.expo/**', 'android/**', 'ios/**'] },
  ...tseslint.configs.recommended,
  { files:['**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'} },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
);
