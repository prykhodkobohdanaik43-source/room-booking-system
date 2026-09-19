import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/backend/**/*.test.js'],
        },
      },
      {
        test: {
          name: 'frontend',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['tests/frontend/setup.js'],
          include: ['tests/frontend/**/*.test.jsx'],
        },
      },
    ],
  },
});
