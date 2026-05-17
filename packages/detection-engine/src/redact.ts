/**
 * Redaction utilities for creating masked previews and sanitised copies.
 * The display functions (redactEmail etc.) create partially masked strings.
 * buildRedactedText produces a full replacement string safe to send.
 */

import type { DetectionMatch } from "@ai-compliance/shared-types";

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  return `${local[0]}***@${domain}`;
}

export function redactIban(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 8) return "****";
  return `${clean.slice(0, 4)}${"*".repeat(clean.length - 8)}${clean.slice(-4)}`;
}

export function redactCreditCard(cc: string): string {
  const digits = cc.replace(/\D/g, "");
  if (digits.length < 8) return "****";
  return `${digits.slice(0, 4)} **** **** ${digits.slice(-4)}`;
}

export function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function redactGeneric(text: string): string {
  if (text.length <= 4) return "****";
  return `${text.slice(0, 2)}${"*".repeat(text.length - 4)}${text.slice(-2)}`;
}

export function redactMatch(text: string, category: string): string {
  switch (category) {
    case "email":
      return redactEmail(text);
    case "iban":
      return redactIban(text);
    case "credit_card":
      return redactCreditCard(text);
    case "phone":
      return redactPhone(text);
    default:
      return redactGeneric(text);
  }
}

/**
 * Replacement labels used in the sanitised output text.
 * These are shown to the user and sent in place of the sensitive value.
 */
const REDACT_LABELS: Record<string, string> = {
  email: "[E-MAIL]",
  phone: "[TELEFON]",
  iban: "[IBAN]",
  swift_bic: "[SWIFT/BIC]",
  credit_card: "[KREDITKARTE]",
  address: "[ADRESSE]",
  customer_id: "[KUNDEN-ID]",
  employee_id: "[MITARBEITER-ID]",
  secret: "[GEHEIMNIS]",
  hr_data: "[HR-DATEN]",
  custom_keyword: "[GESPERRT]",
};

/**
 * Builds a sanitised copy of `text` by replacing every detection match with
 * its category label (e.g. "[E-MAIL]").
 *
 * Replacements are applied right-to-left so earlier offsets stay valid.
 * Overlapping matches are resolved first (longer / higher-severity match wins)
 * so that structural false-positives — e.g. the phone regex matching digits
 * inside an IBAN — cannot corrupt the surrounding replacements.
 */
export function buildRedactedText(text: string, matches: DetectionMatch[]): string {
  type Positioned = DetectionMatch & { start: number; end: number };

  const positioned = matches.filter(
    (m): m is Positioned => m.start !== undefined && m.end !== undefined,
  );

  if (positioned.length === 0) return text;

  // Resolve overlaps: prefer longer span, break ties by category priority
  const CATEGORY_PRIORITY: Record<string, number> = {
    secret: 10,
    credit_card: 9,
    iban: 8,
    swift_bic: 8,
    hr_data: 7,
    email: 6,
    phone: 5,
    address: 4,
    employee_id: 3,
    customer_id: 2,
    custom_keyword: 1,
  };

  const byPriority = [...positioned].sort((a, b) => {
    const spanDiff = b.end - b.start - (a.end - a.start);
    if (spanDiff !== 0) return spanDiff;
    return (CATEGORY_PRIORITY[b.category] ?? 0) - (CATEGORY_PRIORITY[a.category] ?? 0);
  });

  const nonOverlapping: Positioned[] = [];
  for (const m of byPriority) {
    const overlaps = nonOverlapping.some((k) => m.start < k.end && m.end > k.start);
    if (!overlaps) nonOverlapping.push(m);
  }

  // Sort descending by start — replace from end of string to preserve offsets
  nonOverlapping.sort((a, b) => b.start - a.start);

  let result = text;
  for (const match of nonOverlapping) {
    const label = REDACT_LABELS[match.category] ?? "[GESPERRT]";
    result = result.slice(0, match.start) + label + result.slice(match.end);
  }
  return result;
}
