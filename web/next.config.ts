import type { NextConfig } from "next";
import path from "path";

// Amplify runs `npm ci` only in this app. Webpack resolves a bare import from
// the file that contains it, then walks parent node_modules directories.
// packages/print-core sits beside web/, so that walk never enters
// web/node_modules. earcut and opentype.js are imported there; opentype.js
// also depends on tiny-inflate and string.prototype.codepointat, which npm
// hoists into the same install. Keep the default relative lookup, then fall
// back to this app so any of those packages (and later print-core deps
// installed here) resolve during `next build`.
const appNodeModules = path.resolve(__dirname, "node_modules");

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve ??= {};
    const modules = config.resolve.modules ?? ["node_modules"];
    if (!modules.includes(appNodeModules)) {
      config.resolve.modules = [...modules, appNodeModules];
    }
    return config;
  },
};

export default nextConfig;
