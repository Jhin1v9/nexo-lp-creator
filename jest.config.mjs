export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Root runner is scoped to the server/backend suite. Frontend tests live in
  // nexo-lp-web and should be run with that package's own tooling/config.
  testMatch: ['<rootDir>/nexo-lp-server/tests/**/*.test.js', '<rootDir>/nexo-lp-server/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    '/e2e/',
    '/dist/',
    '/coverage/',
    '/nexo-lp-server/tests/security/sandbox.test.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    '/e2e/',
    '/dist/',
  ],
  modulePathIgnorePatterns: [
    '/.worktrees/',
    '/dist/',
  ],
};
