import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Vitest 4 trimmed default excludes; without this, compiled tests under
    // dist/ would run alongside the source tests.
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});
