import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Main build — background (ESM, service worker supports modules) and popup
 * (ESM, loaded via <script type="module"> in HTML).
 *
 * The content script is built separately (vite.content.config.ts) because
 * Chrome content scripts are injected as classic scripts and cannot use
 * ES module import/export syntax.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
    sourcemap: process.env.NODE_ENV === "development",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
