// Fork-owned tooling. The root .eslintrc.cjs only declares an ESM override for
// src/**/*.mjs, so without this ESLint parses these files as scripts and rejects
// their imports. Kept here instead of editing the upstream config.
module.exports = {
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
    },
    env: {
        node: true,
        es6: true,
    },
};
