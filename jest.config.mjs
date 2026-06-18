export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.worktrees/',
    '/e2e/',
    '/dist/',
    '/coverage/',
    '/nexo-lp-server/tests/security/sandbox.test.js',
    '/nexo-lp-web/tests/',
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
