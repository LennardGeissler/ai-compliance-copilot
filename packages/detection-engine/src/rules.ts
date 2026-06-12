import type { DetectionCategory } from "@ai-compliance/shared-types";

export interface DetectionRule {
  id: string;
  category: DetectionCategory;
  name: string;
  pattern: RegExp;
  severity: number;
  validate?: (match: string) => boolean;
}

// --- Email ---

/**
 * RFC 2606 reserved domains + common test domains that are never real user data.
 * Includes subdomains via the suffix check in validateEmail.
 */
const EXAMPLE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "test.de",
  "test.org",
  "test.net",
]);

/**
 * Returns false (discard match) for addresses that are definitively not real:
 *  - known example/test domains
 *  - subdomains of those (e.g. mail.example.com)
 *  - local part is literally "test"
 */
function validateEmail(match: string): boolean {
  const atIdx = match.indexOf("@");
  if (atIdx === -1) return false;
  const localPart = match.slice(0, atIdx).toLowerCase();
  const domain = match.slice(atIdx + 1).toLowerCase();
  if (localPart === "test") return false;
  if (EXAMPLE_EMAIL_DOMAINS.has(domain)) return false;
  // Catch subdomains like mail.example.com
  for (const d of EXAMPLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${d}`)) return false;
  }
  return true;
}

const emailRule: DetectionRule = {
  id: "email-address",
  category: "email",
  name: "Email Address",
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  severity: 40,
  validate: validateEmail,
};

// --- Phone ---
const phoneRule: DetectionRule = {
  id: "phone-number",
  category: "phone",
  name: "Phone Number",
  // Matches international and common formats
  pattern: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  severity: 30,
};

// --- IBAN ---

/**
 * Total IBAN length per country (ISO 13616 / SWIFT IBAN registry).
 * Length includes the 2-letter country code and 2 check digits.
 */
const IBAN_COUNTRY_LENGTHS: Record<string, number> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BI: 27,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  LY: 25,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SD: 18,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
};

/**
 * Validates an IBAN per ISO 13616:
 *  1. country-specific total length
 *  2. MOD-97 checksum (rearrange, letters→digits, mod 97 === 1)
 *
 * Returns false (discard match) for structurally well-shaped strings that
 * fail the checksum or have the wrong length for their country.
 */
function validateIban(match: string): boolean {
  const iban = match.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;

  const country = iban.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[country];
  if (expectedLength === undefined || iban.length !== expectedLength) return false;

  // Move the first four characters to the end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Replace each letter with two digits: A=10, B=11, ... Z=35
  let numeric = "";
  for (const ch of rearranged) {
    if (ch >= "A" && ch <= "Z") {
      numeric += (ch.charCodeAt(0) - 55).toString();
    } else {
      numeric += ch;
    }
  }

  // Compute mod 97 in chunks to stay within safe integer range
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = parseInt(String(remainder) + numeric.slice(i, i + 7), 10) % 97;
  }

  return remainder === 1;
}

const ibanRule: DetectionRule = {
  id: "iban",
  category: "iban",
  name: "IBAN",
  pattern: /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?(?:[\dA-Z]{4}[\s]?){1,7}[\dA-Z]{1,4}\b/g,
  severity: 70,
  validate: validateIban,
};

// --- EU VAT ID ---
const vatIdRule: DetectionRule = {
  id: "eu-vat-id",
  category: "vat_id",
  name: "EU VAT ID",
  pattern:
    /\b(?:AT ?U\d{8}|BE ?0?\d{9}|DE ?\d{9}|FR ?[A-HJ-NP-Z0-9]{2} ?\d{9}|GB ?\d{9}|ES ?[A-Z0-9]\d{7}[A-Z0-9])\b/g,
  severity: 65,
};

// --- SWIFT / BIC ---
const ISO_3166_1_ALPHA_2 = new Set([
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
]);

function validateSwiftBic(match: string): boolean {
  return ISO_3166_1_ALPHA_2.has(match.slice(4, 6));
}

const swiftBicRule: DetectionRule = {
  id: "swift-bic",
  category: "swift_bic",
  name: "SWIFT/BIC Code",
  // Heuristic: contiguous uppercase SWIFT/BIC only (no spaced format).
  // ISO country-code filtering reduces false positives but does not prove the bank exists.
  pattern: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
  severity: 70,
  validate: validateSwiftBic,
};

// --- Internal IP Address ---
const internalIpRule: DetectionRule = {
  id: "internal-ip",
  category: "internal_ip",
  name: "Internal IP Address",
  pattern:
    /\b(?:10\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])|192\.168\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5]))\b/g,
  severity: 40,
};

// --- Credit Card ---
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/**
 * Well-known test card numbers published by Stripe, PayPal, Braintree, etc.
 * These pass the Luhn check but are never real payment data.
 */
const KNOWN_TEST_CARD_NUMBERS = new Set([
  "4111111111111111", // Visa generic test
  "4242424242424242", // Stripe Visa
  "4000056655665556", // Stripe Visa debit
  "4000000000000002", // Stripe declined card
  "5555555555554444", // Stripe Mastercard
  "5200828282828210", // Stripe Mastercard debit
  "5105105105105100", // Mastercard generic test
  "2223003122003222", // Mastercard 2-series test
  "378282246310005", // Amex test
  "371449635398431", // Amex test 2
  "6011111111111117", // Discover test
  "6011000990139424", // Discover test 2
  "3530111333300000", // JCB test
  "3566002020360505", // JCB test 2
  "6304000000000000", // Maestro test
]);

function validateCreditCard(match: string): boolean {
  const digits = match.replace(/\D/g, "");
  if (KNOWN_TEST_CARD_NUMBERS.has(digits)) return false;
  return luhnCheck(match);
}

const creditCardRule: DetectionRule = {
  id: "credit-card",
  category: "credit_card",
  name: "Credit Card Number",
  pattern: /\b(?:\d{4}[\s-]?){3}\d{1,4}\b/g,
  severity: 80,
  validate: validateCreditCard,
};

// --- Secrets / API Keys ---
const secretRules: DetectionRule[] = [
  {
    id: "secret-api-key-generic",
    category: "secret",
    name: "Generic API Key",
    pattern:
      /(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{16,})["']?/gi,
    severity: 90,
  },
  {
    id: "secret-aws-key",
    category: "secret",
    name: "AWS Access Key",
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 95,
  },
  {
    id: "secret-bearer-token",
    category: "secret",
    name: "Bearer Token",
    pattern: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/g,
    severity: 85,
  },
  {
    id: "secret-private-key",
    category: "secret",
    name: "Private Key",
    pattern: /-----BEGIN\s(?:RSA\s)?PRIVATE\sKEY-----/g,
    severity: 95,
  },
  {
    id: "secret-password",
    category: "secret",
    name: "Password Assignment",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
    severity: 80,
  },
  {
    id: "secret-jwt",
    category: "secret",
    name: "JWT Token",
    pattern: /\beyJhbGci[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    severity: 85,
  },
];

// --- Address (heuristic) ---
const addressRule: DetectionRule = {
  id: "postal-address",
  category: "address",
  name: "Postal Address",
  // Heuristic: street number + street name + postal code pattern
  pattern:
    /\b\d{1,5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,40},?\s*\d{4,5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{2,30}\b/g,
  severity: 50,
};

// German address format
const addressRuleDE: DetectionRule = {
  id: "postal-address-de",
  category: "address",
  name: "German Postal Address",
  pattern:
    /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,40}\s+\d{1,5}[a-zA-Z]?,?\s*\d{5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{2,30}/g,
  severity: 50,
};

// --- HR Data ---
const hrDataRules: DetectionRule[] = [
  {
    id: "hr-salary",
    category: "hr_data",
    name: "Salary Information",
    pattern:
      /(?:salary|gehalt|compensation|vergütung|lohn)\s*[:=]?\s*[\d.,]+\s*(?:€|EUR|USD|\$|k)?/gi,
    severity: 60,
  },
  {
    id: "hr-ssn",
    category: "hr_data",
    name: "Social Security / Tax ID",
    pattern:
      /(?:sozialversicherungsnummer|steuer-?id|tax\s*id|ssn|sv-?nummer)\s*[:=]?\s*[\d\s/-]{6,}/gi,
    severity: 75,
  },
];

// --- Employee ID ---
const employeeIdRule: DetectionRule = {
  id: "employee-id",
  category: "employee_id",
  name: "Employee Identifier",
  pattern:
    /(?:employee[_\s-]?id|mitarbeiter[_\s-]?nr|personal[_\s-]?nummer)\s*[:=]?\s*[A-Z0-9-]{3,}/gi,
  severity: 40,
};

// --- Customer ID ---
const customerIdRule: DetectionRule = {
  id: "customer-id",
  category: "customer_id",
  name: "Customer / Order ID",
  pattern:
    /(?:customer[_\s-]?id|kunden[_\s-]?nr|order[_\s-]?id|bestell[_\s-]?nr|ticket[_\s-]?id)\s*[:=]?\s*[A-Z0-9-]{3,}/gi,
  severity: 35,
};

// --- Contextual / Semantic Heuristics ---
//
// These rules detect sensitive values expressed in natural language rather than
// structured formats.  Lookbehind assertions match only the VALUE so that the
// surrounding phrase is preserved when text is redacted.
//
// Variable-length lookbehinds are supported in Chrome 62+ (V8) — the minimum
// required by Manifest V3 extensions.

const contextualRules: DetectionRule[] = [
  // "Mein Passwort lautet abc123" / "Das Passwort ist abc123"
  {
    id: "ctx-password-de",
    category: "secret",
    name: "Passwort (natürliche Sprache, DE)",
    pattern:
      /(?<=(?:mein\s+passwort|das\s+passwort|passwort\s+lautet?|passwort\s+ist)\s+)["']?\S{6,}["']?/gi,
    severity: 80,
  },
  // "My password is abc123" / "login password is abc123"
  {
    id: "ctx-password-en",
    category: "secret",
    name: "Password (natural language, EN)",
    pattern:
      /(?<=(?:my\s+password|the\s+password|password\s+is|login\s+password\s+is)\s+)["']?\S{6,}["']?/gi,
    severity: 80,
  },
  // "Mein API Key ist sk-abc..." / "der API-Schlüssel lautet abc..."
  {
    id: "ctx-api-key-de",
    category: "secret",
    name: "API-Schlüssel (natürliche Sprache, DE)",
    pattern:
      /(?<=(?:(?:mein|der|unser)\s+)?api[_\s-]?(?:key|schlüssel|token)\s+(?:ist|lautet?|:)\s*)["']?[a-zA-Z0-9_\-\.]{8,}["']?/gi,
    severity: 85,
  },
  // "my API key is abc..." / "the API token is abc..."
  {
    id: "ctx-api-key-en",
    category: "secret",
    name: "API Key (natural language, EN)",
    pattern:
      /(?<=(?:my|the|our)\s+api[_\s-]?(?:key|token)\s+(?:is|:)\s*)["']?[a-zA-Z0-9_\-\.]{8,}["']?/gi,
    severity: 85,
  },
  // "mein Access Token ist ..." / "the bearer token is ..."
  {
    id: "ctx-token-natural",
    category: "secret",
    name: "Token (natürliche Sprache)",
    pattern:
      /(?<=(?:(?:mein|der|the|my)\s+)?(?:access[_\s-]?token|auth[_\s-]?token|bearer[_\s-]?token)\s+(?:ist|lautet?|is|:)\s*)["']?[a-zA-Z0-9_\-\.]{12,}["']?/gi,
    severity: 85,
  },
  // Connection strings with embedded credentials: postgresql://user:pass@host/db
  {
    id: "ctx-connection-string",
    category: "secret",
    name: "Connection String with Credentials",
    pattern:
      /(?:postgresql|mysql|mongodb(?:\+srv)?|redis|mssql|jdbc:[a-z]+):\/\/[^:@\s]+:[^@\s]{4,}@[^\s"']+/gi,
    severity: 90,
  },
  // Environment variable assignments for well-known secret names
  {
    id: "ctx-env-secret",
    category: "secret",
    name: "Environment Variable Secret",
    pattern:
      /\b(?:SECRET|PRIVATE_KEY|ACCESS_KEY|AUTH_TOKEN|API_TOKEN|DATABASE_(?:PASSWORD|PASS)|DB_PASS(?:WORD)?|ENCRYPTION_KEY|SIGNING_KEY|JWT_SECRET|SESSION_SECRET|OAUTH_SECRET|WEBHOOK_SECRET|STRIPE_(?:SECRET|KEY)|SENDGRID_KEY|TWILIO_(?:TOKEN|SID))\s*=\s*["']?[^\s"']{4,}["']?/g,
    severity: 90,
  },
];

// All built-in rules
export const BUILT_IN_RULES: DetectionRule[] = [
  emailRule,
  phoneRule,
  ibanRule,
  internalIpRule,
  vatIdRule,
  swiftBicRule,
  creditCardRule,
  ...secretRules,
  ...contextualRules,
  addressRule,
  addressRuleDE,
  ...hrDataRules,
  employeeIdRule,
  customerIdRule,
];

export { luhnCheck, validateIban };
