# Screenshot & GIF capture checklist

All image paths referenced from the root README live under `docs/images/`. Capture them on a clean browser profile to avoid personal data in screenshots.

## Setup

- Browser: Chrome or Edge, latest stable.
- Window: 1440 × 900 (logical), DPR 2 if possible → sharper PNGs.
- Profile: fresh, no other extensions in the toolbar.
- Extension theme: **dark mode** for all shots (switch via the sun/moon toggle in the popup).
- Language: the UI is currently German; that is fine — it matches the current release.

## Files to produce

| File                 | Type | Target size                                         | What it shows                                                                                                                                 |
| -------------------- | ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo.png`           | PNG  | 192 × 192                                           | Shield logo on transparent background. Use `apps/extension/public/icons/icon128.png` upscaled, or design a proper one.                        |
| `hero.gif`           | GIF  | 720 × 450, < 3 MB                                   | 5 – 10 s loop: typing a prompt with a secret in ChatGPT → warn overlay appears → click "Redact & Send" → sanitized prompt lands in the input. |
| `overlay-block.png`  | PNG  | 1440 × 900 viewport, crop to overlay + some context | Block overlay on ChatGPT triggered by an **AWS access key** (`AKIA…`) plus a private-key fragment.                                            |
| `overlay-warn.png`   | PNG  | same                                                | Warn overlay triggered by an email + German postal address.                                                                                   |
| `popup-activity.png` | PNG  | popup only (340 × ~550)                             | Popup's **Aktivität** tab with a few recent detections visible (dark mode).                                                                   |
| `popup-prompts.png`  | PNG  | popup only                                          | Popup's **Prompt-Bibliothek** tab with 2 – 3 saved prompts.                                                                                   |

## Suggested prompt snippets (safe fakes)

Use these so no real data ends up in screenshots. **Do not** use words like `example`, `sample`, `test`, `fake`, `mock`, `placeholder`, `dummy`, `Beispiel`, `Muster`, `fiktiv` anywhere in the prompt — the detector's example-context heuristic will downgrade every match's confidence and nothing will trigger. Also avoid well-known test card numbers (4111…, 4242…, 5555… etc.) — those are in a denylist.

**High-severity (for block):**

```
Kurzer Review für mein Deploy-Script bitte:
AWS_ACCESS_KEY_ID=AKIA3K7PJXQ9D2VMNRTF
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYzTBQ9abcdEF
Außerdem im Repo: -----BEGIN RSA PRIVATE KEY-----
```

Triggers the `secret-aws-key` (sev 95) and `secret-private-key` (sev 95) rules.

**Mid-severity (for warn):**

```
Kannst du einen Antwortentwurf an anna.mueller@mueller-industries.de formulieren?
Die Postanschrift ist Hauptstraße 12, 10115 Berlin.
```

Triggers `email-address` (sev 40) and `postal-address-de` (sev 50) — combined severity lands in the warn band (30 – 69).

> Keep the AWS key and secret above as-is — they are freshly invented strings (not AWS's documented example values) so they match the `AKIA…` regex without hitting any internal denylist.

## Recording the GIF

- Tool: [ScreenToGif](https://www.screentogif.com/) (Windows) or [Kap](https://getkap.co/) (macOS).
- Frame rate: 15 fps is enough; keeps file small.
- Compress with [gifski](https://gif.ski/) or `ffmpeg -i in.mov -vf "fps=15,scale=720:-1:flags=lanczos" -loop 0 hero.gif`.
- Target **under 3 MB** so GitHub renders it inline without lazy-loading.

## After capturing

1. Drop files into `docs/images/` with the exact filenames above.
2. Run a local preview of the README (`gh markdown-preview` or the VS Code preview) and check each image renders.
3. Commit with a message like `docs: add README screenshots and demo gif`.
