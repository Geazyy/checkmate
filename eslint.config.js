const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['.expo/**', 'dist/**'] },
  // Expo's existing web hydration adapter intentionally changes state after the client mounts.
  { files: ['src/hooks/use-color-scheme.web.ts'], rules: { 'react-hooks/set-state-in-effect': 'off' } },
]);
