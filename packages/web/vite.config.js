import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import thirdPartyGenerator from "./vite-third-party-generator";

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    tailwindcss(),
    react(),
    thirdPartyGenerator,
    // command === "serve" && {
    //   name: "react-devtools",
    //   transformIndexHtml: () => [
    //     {
    //       tag: "script",
    //       attrs: { src: "http://localhost:8097" },
    //       injectTo: "head-prepend",
    //     },
    //   ],
    // },
  ],
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: "@pt/shared",
        replacement: path.resolve(__dirname, "../shared/src/index.ts"),
      },
      // Exact match only — don't redirect subpath imports like maplibre-gl/dist/maplibre-gl.css
      {
        find: /^maplibre-gl$/,
        replacement: path.resolve(
          __dirname,
          "../../node_modules/maplibre-gl/dist/maplibre-gl-csp.js",
        ),
      },
    ],
  },
}));
