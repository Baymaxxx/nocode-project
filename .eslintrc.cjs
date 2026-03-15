module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['build', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['badgeVariants', 'buttonVariants', 'toggleVariants', 'useFormField', 'Form', 'FormItem', 'FormLabel', 'FormControl', 'FormDescription', 'FormMessage', 'FormField', 'navigationMenuTriggerStyle', 'useNoCodeSDK', 'NoCodeProvider'] },
    ],
    'react/prop-types': 'off',
    'no-unused-vars': ['error', { varsIgnorePattern: '^React$' }],
  },
  overrides: [
    {
      files: ['vite.config.js', 'tailwind.config.js', 'postcss.config.js'],
      env: { node: true },
    },
    {
      files: ['src/components/ui/**/*.jsx', 'src/contexts/**/*.jsx'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};
