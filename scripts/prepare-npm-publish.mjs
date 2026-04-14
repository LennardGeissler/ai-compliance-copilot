#!/usr/bin/env node
// Builds a slim, publishable npm package from the built extension.
// Output: ./.release-publish/  (dist + clean package.json + README + LICENSE)
//
// Used by the release workflow to push the extension to GitHub Packages so
// it shows up under the repo's "Packages" tab. The on-disk package.json
// inside apps/extension keeps workspace:* deps; this script strips them
// because the published artifact is a self-contained, prebuilt bundle.

import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(repoRoot, ".release-publish");
const extDir = resolve(repoRoot, "apps/extension");
const distDir = resolve(extDir, "dist");

if (!existsSync(distDir)) {
  console.error(`Missing build output: ${distDir}. Run pnpm build first.`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(distDir, resolve(outDir, "dist"), { recursive: true });

for (const file of ["README.md", "LICENSE"]) {
  const src = resolve(repoRoot, file);
  if (existsSync(src)) cpSync(src, resolve(outDir, file));
}

const src = JSON.parse(readFileSync(resolve(extDir, "package.json"), "utf8"));
const version = process.env.VERSION || src.version;

const slim = {
  name: "@lennardgeissler/ai-compliance-copilot-extension",
  version,
  description: src.description,
  license: src.license,
  author: src.author,
  repository: src.repository,
  homepage: src.homepage,
  bugs: src.bugs,
  keywords: src.keywords,
  files: ["dist/**", "README.md", "LICENSE"],
  publishConfig: {
    registry: "https://npm.pkg.github.com",
    access: "restricted",
  },
};

writeFileSync(resolve(outDir, "package.json"), JSON.stringify(slim, null, 2) + "\n");

console.log(`Prepared ${outDir} for npm publish (v${version})`);
