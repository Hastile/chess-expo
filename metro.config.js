const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ .sqlite 확장자를 에셋으로 인식하도록 추가합니다.
config.resolver.assetExts.push('sqlite');

module.exports = config;