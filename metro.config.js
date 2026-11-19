// Metro do Expo (SDK 54): o mesmo do React Native, com o suporte aos módulos do Expo.
// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// O Metro novo lê o campo "exports" dos pacotes e o Supabase Realtime cai na versão
// para Node (pacote "ws", que pede "stream"). Desligado, volta a usar a do celular,
// como no React Native 0.77.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
