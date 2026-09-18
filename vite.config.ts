// WHAT THIS FILE IS FOR
//   Settings for the tool that turns our screens into a website and into the
//   files the Android app carries inside it.
// `vitest/config` rather than `vite` — it is the same function, but its type
// also understands the test settings below. Importing from 'vite' typechecks
// as an error.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Entry-level phones have little memory. Keeping the first download small
    // is the difference between the app opening and the app being abandoned.
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
})
