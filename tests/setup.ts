import { config } from '../src/config/config';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock logger in tests
jest.mock('../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Global test timeout
jest.setTimeout(30000);

// Clean up after tests
afterAll(async () => {
  // Close database connections, etc.
});