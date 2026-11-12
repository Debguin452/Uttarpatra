import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const API_TARGET = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      "/api": API_TARGET,
      "/public": API_TARGET,
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
