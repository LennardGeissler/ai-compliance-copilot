# Contributing to AI Compliance Copilot

Thanks for your interest in contributing! This project aims to be a privacy-first DLP tool for LLM usage, and community input is welcome.

## Ground rules

- Be respectful — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Security issues: **do not** open public issues. See [SECURITY.md](SECURITY.md).
- By contributing, you agree your contribution is licensed under the [MIT License](LICENSE).
- Sign off your commits (DCO): `git commit -s` adds `Signed-off-by:` confirming you have the right to submit the contribution.

## Local setup

Requirements: Node.js 20+, pnpm 9+.

```bash
git clone https://github.com/<owner>/ai-compliance-copilot.git
cd ai-compliance-copilot
pnpm install
pnpm build
pnpm test
```

Load the extension in Chrome: `chrome://extensions` → "Load unpacked" → select `apps/extension/dist`.

## Workflow

1. Open an issue first for non-trivial changes — aligns scope before you invest time.
2. Branch naming: `feat/short-description`, `fix/short-description`, `docs/...`, `chore/...`.
3. Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(extension): add X`, `fix(detection): handle Y`.
4. Keep PRs focused. One feature or fix per PR.
5. Add tests for detection rules, policy changes, and bug fixes.
6. Run `pnpm lint && pnpm test && pnpm build` before pushing.

## Areas that welcome contributions

- **Detection rules** — additional PII/secret patterns, locale-specific identifiers. See [packages/detection-engine](packages/detection-engine).
- **LLM platform support** — DOM adapters for new chat UIs. See [apps/extension/src/content](apps/extension/src/content).
- **False-positive reports** — open an issue with the `false-positive` template; realistic samples are gold.
- **Translations** — UI strings in the extension. See [Adding a translation](#adding-a-translation).
- **Documentation** — especially `docs/threat-model.md` and integration guides.

## What we don't accept

- Changes that weaken privacy guarantees (e.g. sending prompt content to third parties by default).
- Detection rules without tests.
- Refactors bundled with feature changes.

## Adding a translation

The extension uses [`chrome.i18n`](https://developer.chrome.com/docs/extensions/reference/api/i18n). Locales live under [apps/extension/public/\_locales/](apps/extension/public/_locales/). English (`en`) is the source of truth and the `default_locale` declared in `manifest.json`; the browser UI language picks the active locale, falling back to English.

To add a new language (e.g. French, `fr`):

1. Copy `apps/extension/public/_locales/en/messages.json` to `apps/extension/public/_locales/fr/messages.json`.
2. Translate every `message` value. Keep the keys and any HTML tags (e.g. `<strong>`) intact.
3. If you add a new UI string:
   - Add the key to **every** existing locale (at minimum `en` and `de`).
   - In code, use `t("your_key")` from [`apps/extension/src/i18n.ts`](apps/extension/src/i18n.ts); for static HTML, add `data-i18n="your_key"` (or `data-i18n-placeholder` / `data-i18n-title`).
4. `pnpm --filter ai-compliance-copilot-extension build`, then reload the unpacked extension and switch your browser UI language to verify.

Brand names (ChatGPT, Claude, Gemini, Perplexity) are intentionally not translated.

## Getting help

Open a [Discussion](../../discussions) for questions. For security concerns, follow [SECURITY.md](SECURITY.md).
