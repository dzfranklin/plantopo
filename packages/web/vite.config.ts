import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    tailwindcss(),
    react(),
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
