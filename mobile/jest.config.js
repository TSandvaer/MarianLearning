// jest-expo runs the native app's unit tests (the web app's Vitest suite
// excludes mobile/**). @marian/core resolves through the npm symlink, and
// its .ts sources are transformed like the app's own (they are not under
// node_modules once Jest follows the symlink).
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
}
