const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable .wasm support for expo-sqlite web worker
config.resolver.sourceExts.push('wasm');
config.resolver.assetExts.push('wasm');

module.exports = config;
