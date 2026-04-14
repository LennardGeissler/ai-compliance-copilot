#!/usr/bin/env node
// Bumps the patch version in all workspace package.json files.
// Run from the repo root: node scripts/bump-version.js

const fs = require("fs");
const path = require("path");

const PACKAGES = [
  "package.json",
  "apps/extension/package.json",
  "packages/detection-engine/package.json",
  "packages/policy-engine/package.json",
  "packages/shared-types/package.json",
];

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [major, minor, patch] = rootPkg.version.split(".").map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

for (const rel of PACKAGES) {
  const full = path.resolve(rel);
  const raw = readIfPresent(full);
  if (raw === null) {
    console.warn(`Skipping missing file: ${rel}`);
    continue;
  }
  const pkg = JSON.parse(raw);
  pkg.version = newVersion;
  fs.writeFileSync(full, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  ${rel}  →  ${newVersion}`);
}

const manifestPath = "apps/extension/public/manifest.json";
const manifestRaw = readIfPresent(manifestPath);
if (manifestRaw !== null) {
  const manifest = JSON.parse(manifestRaw);
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  ${manifestPath}  →  ${newVersion}`);
}

console.log(`\nVersion bumped to ${newVersion}`);
