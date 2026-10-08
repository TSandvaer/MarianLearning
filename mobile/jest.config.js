// jest-expo runs the native app's unit tests (the web app's Vitest suite
// excludes mobile/**). @marian/core resolves through the npm symlink, and
// its .ts sources are transformed like the app's own (they are not under
// node_modules once Jest follows the symlink).
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  moduleNameMapper: {
    // Babel adds `@babel/runtime/helpers/*` imports to core's files, and
    // Jest resolves them upward from packages/core/src: from the web app's
    // root node_modules locally, and from nowhere in CI's mobile job (no
    // root install) -> "Cannot find module '@babel/runtime/helpers/
    // interopRequireDefault'". Pin them to mobile's own copy.
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },
}
