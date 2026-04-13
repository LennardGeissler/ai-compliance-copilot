# Detection Engine

Pure-TypeScript pattern matching library. Runs in-browser, no dependencies, deterministic.

Source: [packages/detection-engine/src](../packages/detection-engine/src)

## Categories & severity

| Category         | Examples                                              | Severity     |
| ---------------- | ----------------------------------------------------- | ------------ |
| `email`          | RFC 5322, example.com filtered                        | 40           |
| `phone`          | International formats                                 | 30           |
| `iban`           | EU IBAN with checksum                                 | 70           |
| `credit_card`    | Luhn-validated, test cards filtered                   | 80           |
| `swift_bic`      | SWIFT / BIC bank identification codes (8 or 11 chars)  | 55           |
| `address`        | Generic + German format                               | 50           |
| `employee_id`    | Pattern-based                                         | 40           |
| `customer_id`    | Pattern-based                                         | 35           |
| `secret`         | API keys, AWS, bearer tokens, private keys, passwords | 80–95        |
| `hr_data`        | Salary, SSN/Tax-ID                                    | 60–75        |
| `custom_keyword` | User-defined                                          | configurable |

Severity is a 0–100 integer. Policy thresholds gate `warn` vs `block`.

## Confidence scoring

- **0.95** — rules with structural validation (Luhn, IBAN checksum).
- **0.80** — pattern-only matches.
- **× 0.3** — if the surrounding text suggests an example context (e.g. "for example", "z.B.", "like").

Findings below a policy's `minConfidence` are dropped.

## Contextual detection

Beyond regex, the engine checks natural-language cues in English and German — e.g. "das Passwort ist …", "API key:", "connection string". See [rules.ts](../packages/detection-engine/src/rules.ts).

## Writing a custom rule

```ts
import type { DetectionRule } from "@ai-compliance/shared-types";

export const acmeCustomerRule: DetectionRule = {
  id: "acme-customer-id",
  category: "customer_id",
  pattern: /\bACME-\d{6}\b/g,
  severity: 50,
  confidence: 0.9,
  description: "ACME internal customer ID",
};
```

Register it via the org config (dashboard) or by extending the default ruleset when building a fork.

## Testing

Every rule should have a test in [packages/detection-engine/src/\_\_tests\_\_](../packages/detection-engine/src/__tests__) covering:

- at least one positive match,
- at least one negative (false-positive guard),
- an example-context case to verify confidence dampening.

Run: `pnpm --filter @ai-compliance/detection-engine test`.
