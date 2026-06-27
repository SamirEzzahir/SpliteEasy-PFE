// babel.config.js — Expo preset handles JSX/TS, the `@/*` tsconfig path alias,
// and expo-router.
//
// The explicit private-field/class-property transforms below down-level `#x`
// private syntax (used by React Native 0.81's core DOMRect polyfill in
// setUpDefaultReactNativeEnvironment) to WeakMap-based code. Without this the
// Hermes engine in Expo Go throws "private properties are not supported" at
// startup. `loose: true` keeps all three consistent.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ],
  };
};
