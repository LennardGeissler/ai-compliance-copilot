#!/usr/bin/env node
// Conventional-Commits-driven version bump.
//
// Reads commits since the last `v*` tag, determines the highest required
// bump (major / minor / patch / none) and updates package.json files plus
// the extension manifest accordingly.
//
// Mapping:
//   - feat:            -> minor
//   - fix: | perf:     -> patch
//   - feat!: / fix!: / BREAKING CHANGE: footer
//                      -> major  (mapped down to minor while still on 0.x,
//                                 matching semantic-release default)
//   - chore/docs/style/refactor/test/ci/build/...
//                      -> no release
//
// CLI:
//   node scripts/bump-version.js            # write changes, output release-info.json
//   node scripts/bump-version.js --dry-run  # report only, no file writes
//
// Output: `release-info.json` at the repo root with shape
//   { shouldRelease, type, previousVersion, newVersion, commits: [{hash, subject, type}] }

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PACKAGES = [
  "package.json",
  "apps/extension/package.json",
  "packages/detection-engine/package.json",
  "packages/policy-engine/package.json",
  "packages/shared-types/package.json",
];
const MANIFEST = "apps/extension/public/manifest.json";

const DRY_RUN = process.argv.includes("--dry-run");

const BUMP_LEVEL = { none: 0, patch: 1, minor: 2, major: 3 };
const HIGHER = (a, b) => (BUMP_LEVEL[a] >= BUMP_LEVEL[b] ? a : b);

// Commit subject regex: type(scope)?!: subject
const HEADER_RE = /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*(?<subject>.+)$/;
const BREAKING_FOOTER_RE = /^BREAKING[ -]CHANGE:/m;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function lastReleaseTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  } catch {
    return null;
  }
}

function commitsSince(tag) {
  // %x1e = record separator, %x1f = field separator — safe vs newlines in bodies.
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const format = "%H%x1f%B%x1e";
  let raw;
  try {
    raw = git(["log", range, `--format=${format}`]);
  } catch {
    return [];
  }
  return raw
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((rec) => {
      const [hash, message = ""] = rec.split("\x1f");
      const subject = message.split("\n")[0].trim();
      return { hash: hash.trim(), subject, message: message.trim() };
    });
}

function classifyCommit(commit) {
  const m = commit.subject.match(HEADER_RE);
  if (!m) return { type: "other", bump: "none" };

  const { type, bang } = m.groups;
  const lowerType = type.toLowerCase();
  const isBreaking = Boolean(bang) || BREAKING_FOOTER_RE.test(commit.message);

  if (isBreaking) return { type: lowerType, bump: "major" };
  if (lowerType === "feat") return { type: lowerType, bump: "minor" };
  if (lowerType === "fix" || lowerType === "perf") return { type: lowerType, bump: "patch" };
  return { type: lowerType, bump: "none" };
}

function aggregateBump(commits) {
  let level = "none";
  for (const c of commits) {
    const cls = classifyCommit(c);
    c.classifiedType = cls.type;
    c.classifiedBump = cls.bump;
    level = HIGHER(level, cls.bump);
  }
  return level;
}

function applyBump(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  // Pre-1.0 safeguard: breaking changes bump minor, not major,
  // to avoid an accidental 1.0.0 release.
  const effective = type === "major" && major === 0 ? "minor" : type;
  switch (effective) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return current;
  }
}

function writeJson(file, obj) {
  if (DRY_RUN) return;
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

function setVersion(file, version) {
  const raw = readIfPresent(file);
  if (raw === null) {
    console.warn(`Skipping missing file: ${file}`);
    return false;
  }
  const json = JSON.parse(raw);
  json.version = version;
  writeJson(file, json);
  console.log(`  ${file}  →  ${version}`);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const previousVersion = rootPkg.version;
const tag = lastReleaseTag();
const commits = commitsSince(tag);
const bump = aggregateBump(commits);
const newVersion = applyBump(previousVersion, bump);
const shouldRelease = bump !== "none";

const summary = {
  shouldRelease,
  type: bump,
  previousVersion,
  newVersion,
  baseTag: tag,
  commitCount: commits.length,
  commits: commits.map((c) => ({
    hash: c.hash.slice(0, 7),
    subject: c.subject,
    type: c.classifiedType,
    bump: c.classifiedBump,
  })),
};

writeJson(path.resolve("release-info.json"), summary);

if (!shouldRelease) {
  console.log(
    `No release-worthy commits since ${tag ?? "(initial commit)"} ` +
      `(${commits.length} commit${commits.length === 1 ? "" : "s"}). Skipping bump.`,
  );
  process.exit(0);
}

console.log(
  `Bump: ${bump} (${previousVersion} → ${newVersion}, base: ${tag ?? "(no tag)"}, ` +
    `${commits.length} commit${commits.length === 1 ? "" : "s"})`,
);
console.log();

for (const rel of PACKAGES) setVersion(rel, newVersion);
setVersion(MANIFEST, newVersion);

console.log(`\nVersion bumped to ${newVersion}${DRY_RUN ? " (dry-run, no files written)" : ""}`);
