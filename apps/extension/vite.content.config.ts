import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate build for the content script.
 *
 * Chrome content scripts are injected as classic scripts — ES module syntax
 * (import/export) is not supported.  Building as IIFE with
 * inlineDynamicImports ensures everything is bundled into a single file
 * without any import statements.
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
        inlineDynamicImports: true,
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
