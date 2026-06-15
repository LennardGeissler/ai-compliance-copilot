import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate build for the content script.
 *
 * Chrome content scripts are injected as classic scripts — ES module syntax
 * (import/export) is not supported. Building as IIFE bundles everything
 * into a single file without import statements; Vite 7+ disables code
 * splitting automatically for IIFE, so no extra rollup options are needed.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    // Don't wipe the output of the main build
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
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
