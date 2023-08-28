import { server } from './src/mocks/server';
import { beforeAll, afterEach, afterAll } from '@jest/globals';
import { jestPreviewConfigure } from 'jest-preview';
import console from 'console';

global.console = console; // Just more readable output
jestPreviewConfigure({ autoPreview: true });

// Establish API mocking before all tests.
beforeAll(() => server.listen());

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
