import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // better-sqlite3 es un módulo nativo: procesos separados en vez de worker threads.
    pool: 'forks',
  },
});
