import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mswServer';

// Setup MSW server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  // Cleanup DOM apres chaque test
  cleanup();
  // Reset MSW handlers
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
