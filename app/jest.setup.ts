import { server } from './src/mocks/server';
import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { jestPreviewConfigure } from 'jest-preview';
import console from 'console';

process.env.NEXT_PUBLIC_API_ENDPOINT = 'https://test-api.plantopo.com/';

global.console = console; // Just more readable output
jestPreviewConfigure({ autoPreview: true });

beforeAll(() => {
  server.listen(); // Establish API mocking before all tests.
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
