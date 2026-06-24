module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts?(x)'],
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  }
};