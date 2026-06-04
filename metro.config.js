const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const escapeForRegex = (s) => s.replace(/[\\/.+*?^$()[\]{}|]/g, '\\$&');
const sep = '[\\\\/]';
const ignoredFolders = ['functions', '_migrate', 'android', 'ios', '.idea', '.vscode'];
const ignoredPattern = new RegExp(
  '^' + escapeForRegex(__dirname) + sep + '(?:' + ignoredFolders.join('|') + ')' + sep + '.*$',
);

config.resolver.blockList = ignoredPattern;

module.exports = withNativeWind(config, { input: './global.css' });
