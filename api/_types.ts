// The /api wire contract lives in `@marian/core` so the web app and the
// React Native app share one definition. The server keeps importing
// `./_types.js`; this file only re-exports it.
//
// Why a RELATIVE path into packages/core, not `@marian/core/wire/types`:
// @vercel/node compiles each traced .ts file to its own .js and runs it
// as plain Node ESM, without bundling. Node would resolve the package
// specifier through packages/core/package.json `exports`, which points at
// `.ts` sources that do not exist in the deployed function (they were
// compiled to .js). A relative `.js` path is the shape every other
// api/ import already uses (see the require-js-extension lint rule).
//
// Keep packages/core/src/wire/types.ts free of imports, or give every
// import in it a `.js` extension (the lint rule enforces this for
// packages/core/src/wire/**).
export * from '../packages/core/src/wire/types.js'
