# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Report vulnerabilities privately via GitHub's [Security Advisory](../../security/advisories/new) feature. This creates an encrypted channel with the maintainers.

Include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept welcome)
- Affected versions / commit hashes
- Your contact info for follow-up

## Disclosure Timeline

- **Within 72 hours** — acknowledgement of receipt
- **Within 14 days** — initial assessment and severity classification
- **Within 90 days** — coordinated disclosure after a fix is released, or earlier if agreed

We credit reporters in the release notes unless you prefer to stay anonymous.

## No Bug Bounty

This project does **not** operate a paid bug bounty program. Reporters receive credit in release notes; monetary demands, invoices, or "pay-to-disclose" requests will be closed without response.

## Supported Versions

Only the latest minor release receives security patches. We recommend always running the latest version.

## Scope

In scope:

- The browser extension ([apps/extension](apps/extension))
- The detection engine ([packages/detection-engine](packages/detection-engine))
- The policy engine ([packages/policy-engine](packages/policy-engine))
- Shared types ([packages/shared-types](packages/shared-types))
- Release artifacts and build pipeline

Out of scope:

- Third-party LLM provider websites (ChatGPT, Claude, Gemini, etc.) — report to the respective vendor
- Self-hosted dashboards or custom integrations
- Social engineering, physical attacks, denial-of-service

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations and service disruption
- Only interact with accounts they own or have explicit permission to test
- Report findings privately and give us reasonable time to respond before disclosure
