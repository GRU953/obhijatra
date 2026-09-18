// WHAT THIS FILE IS FOR
//   Three rules that make the app's one real weakness impossible to introduce
//   by accident. A form label written by an administrator must never be able
//   to run as code, because the browser view holds the database key.
//
//   These are all CORE rules. We deliberately do not use a plugin for them:
//   a core rule cannot be abandoned by its maintainer, which matters over the
//   ten years this project has to survive.
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'android/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      // Rule 1: administrator-written text renders as text, never as markup.
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'Form labels are written by administrators. Rendering them as markup would let a hostile label reach the phone database. Render as text.',
      }],
      'no-restricted-properties': ['error',
        { object: 'document', property: 'write', message: 'Renders unchecked markup. Use React.' },
        { property: 'innerHTML', message: 'Renders unchecked markup. Use textContent, or let React render it.' },
      ],
      // Rule 2: skip logic is a rule we read, never code we run.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
)
