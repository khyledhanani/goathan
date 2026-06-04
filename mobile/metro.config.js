const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Follow the convex symlink so Metro can resolve shared backend code
config.watchFolders = [path.resolve(__dirname, "../web/convex")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
