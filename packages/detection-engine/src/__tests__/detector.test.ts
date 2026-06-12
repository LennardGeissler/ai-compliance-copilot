import { describe, it, expect } from "vitest";
import { detect } from "../detector";

describe("Detection Engine", () => {
  describe("Email detection", () => {
    it("detects real email addresses", () => {
      const result = detect("Contact me at john.doe@acme.com for details");
      expect(result.categories).toContain("email");
      expect(result.matches.some((m) => m.category === "email")).toBe(true);
    });

    it("detects multiple real emails", () => {
      const result = detect("Send to alice@company.com and bob@corp.de");
      const emailMatches = result.matches.filter((m) => m.category === "email");
      expect(emailMatches.length).toBe(2);
    });
  });

  describe("IBAN detection", () => {
    it("detects German IBAN", () => {
      const result = detect("IBAN: DE89370400440532013000");
      expect(result.categories).toContain("iban");
    });

    it("detects IBAN with spaces", () => {
      const result = detect("IBAN: DE89 3704 0044 0532 0130 00");
      expect(result.categories).toContain("iban");
    });

    it("detects valid IBANs from several countries", () => {
      const valid = [
        "GB82WEST12345698765432",
        "FR1420041010050500013M02606",
        "NL91ABNA0417164300",
        "CH9300762011623852957",
        "BE68539007547034",
      ];
      for (const iban of valid) {
        const result = detect(`Account: ${iban}`);
        expect(result.categories, iban).toContain("iban");
      }
    });

    it("rejects well-shaped strings that fail the MOD-97 checksum", () => {
      // Correct length for DE but wrong check digits
      const result = detect("DE00370400440532013000");
      expect(result.categories).not.toContain("iban");
    });

    it("rejects IBANs with the wrong length for their country", () => {
      // DE must be 22 chars; this is one digit short
      const result = detect("DE8937040044053201300");
      expect(result.categories).not.toContain("iban");
    });

    it("rejects unknown country codes", () => {
      const result = detect("ZZ89370400440532013000");
      expect(result.categories).not.toContain("iban");
    });
  });

  describe("EU VAT ID detection", () => {
    it("detects major EU VAT ID formats", () => {
      const result = detect(
        "VAT IDs: DE123456789, FRAB123456789, ATU12345678, GB123456789, ESX1234567A",
      );
      const vatMatches = result.matches.filter((m) => m.category === "vat_id");

      expect(result.categories).toContain("vat_id");
      expect(vatMatches.map((m) => m.matchedText).sort()).toEqual(
        ["DE123456789", "FRAB123456789", "ATU12345678", "GB123456789", "ESX1234567A"].sort(),
      );
    });

    it("detects VAT IDs with a single separator after the country prefix", () => {
      const result = detect("Supplier VAT numbers: DE 123456789 and AT U12345678");
      const vatMatches = result.matches.filter((m) => m.category === "vat_id");

      expect(vatMatches.map((m) => m.matchedText)).toEqual(["DE 123456789", "AT U12345678"]);
    });

    it("assigns medium severity to VAT IDs", () => {
      const result = detect("Business partner VAT ID: DE123456789");

      expect(result.severityScore).toBe(52);
      expect(result.recommendation).toBe("warn");
    });

    it("rejects incomplete VAT-like values", () => {
      const result = detect("Invalid values: DE12345, ATU1234, NL123456789B");

      expect(result.matches.filter((m) => m.category === "vat_id").length).toBe(0);
    });
  });

  describe("SWIFT/BIC detection", () => {
    it("detects 8-character SWIFT/BIC codes", () => {
      const result = detect("Receiving bank BIC: DEUTDEFF");
      expect(result.categories).toContain("swift_bic");
    });

    it("detects 11-character SWIFT/BIC codes", () => {
      const result = detect("Use DEUTDEFF500 or COBADEFFXXX for the transfer");
      const bicMatches = result.matches.filter((m) => m.category === "swift_bic");
      expect(bicMatches.length).toBe(2);
    });

    it("detects SWIFT/BIC codes with other valid ISO country codes", () => {
      const result = detect("BNPAFRPPXXX");
      expect(result.categories).toContain("swift_bic");
    });

    it("rejects SWIFT/BIC-like values with invalid country codes", () => {
      const result = detect("Invalid code: DEUTZZFFXXX");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("rejects 7-character SWIFT/BIC-like values", () => {
      const result = detect("BIC: DEUTDEF");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("rejects 9-character SWIFT/BIC-like values", () => {
      const result = detect("BIC: DEUTDEFF5");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("rejects 10-character SWIFT/BIC-like values", () => {
      const result = detect("BIC: DEUTDEFF50");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("rejects 12-character SWIFT/BIC-like values", () => {
      const result = detect("BIC: DEUTDEFF5000");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("rejects lowercase SWIFT/BIC codes", () => {
      const result = detect("BIC: deutdeff");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("detects SWIFT/BIC codes inside punctuation boundaries", () => {
      const result = detect("(DEUTDEFF), DEUTDEFF, DEUTDEFF.");
      const bicMatches = result.matches.filter((m) => m.category === "swift_bic");
      expect(bicMatches.length).toBe(3);
    });

    it("does not detect SWIFT/BIC codes embedded inside longer strings", () => {
      const result = detect("XDEUTDEFFY");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("detects IBAN and SWIFT/BIC in the same string", () => {
      const result = detect("IBAN: DE89370400440532013000 BIC: DEUTDEFF");
      expect(result.categories).toContain("iban");
      expect(result.categories).toContain("swift_bic");
    });

    it("does not detect SWIFT/BIC in empty input", () => {
      const result = detect("");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("does not detect SWIFT/BIC in null-like input", () => {
      const result = detect(null as unknown as string);
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("does not detect SWIFT/BIC in whitespace input", () => {
      const result = detect("   \n\t   ");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });

    it("accepts valid-country SWIFT/BIC-shaped tokens as heuristic matches", () => {
      // ABCDUS12 has a valid ISO country segment ("US"), so the heuristic accepts it.
      const result = detect("Reference: ABCDUS12");
      expect(result.categories).toContain("swift_bic");
    });

    it("rejects separator-formatted SWIFT/BIC values", () => {
      // The rule intentionally supports contiguous SWIFT/BIC codes only.
      const result = detect("BIC: DEUT-DE-FF");
      expect(result.matches.filter((m) => m.category === "swift_bic").length).toBe(0);
    });
  });

  describe("Internal IP detection", () => {
    it("detects RFC 1918 private IPv4 addresses", () => {
      const result = detect("Servers are at 10.0.1.42, 172.16.0.1 and 192.168.1.100");
      const internalIpMatches = result.matches.filter((m) => m.category === "internal_ip");

      expect(result.categories).toContain("internal_ip");
      expect(internalIpMatches.length).toBe(3);
    });

    it("detects the full 172.16.0.0/12 range", () => {
      const result = detect("Internal host: 172.31.255.255");
      expect(result.categories).toContain("internal_ip");
    });

    it("does not flag public IPv4 addresses", () => {
      const result = detect("Public DNS: 8.8.8.8 and public IP: 1.2.3.4");
      expect(result.matches.filter((m) => m.category === "internal_ip").length).toBe(0);
    });

    it("does not flag invalid IPv4 addresses", () => {
      const result = detect("Invalid addresses: 999.999.999.999 and 192.168.1.999");
      expect(result.matches.filter((m) => m.category === "internal_ip").length).toBe(0);
    });

    it("returns warn for a single internal IP", () => {
      const result = detect("DB host: 10.0.1.42");
      expect(result.categories).toContain("internal_ip");
      expect(result.severityScore).toBeGreaterThanOrEqual(30);
      expect(result.recommendation).toBe("warn");
    });
  });

  describe("Credit card detection", () => {
    it("detects valid non-test credit card numbers", () => {
      // Luhn-valid number that is not in the known test-card allowlist
      const result = detect("Card: 4916 3385 0608 2832");
      expect(result.categories).toContain("credit_card");
    });

    it("rejects invalid credit card numbers (Luhn check)", () => {
      const result = detect("Number: 1234 5678 9012 3456");
      const ccMatches = result.matches.filter((m) => m.category === "credit_card");
      expect(ccMatches.length).toBe(0);
    });
  });

  describe("Secret/API key detection", () => {
    it("detects API keys", () => {
      const result = detect('const apiKey = "sk_live_abc123def456ghi789"');
      expect(result.categories).toContain("secret");
    });

    it("detects AWS access keys", () => {
      const result = detect("AKIAIOSFODNN7EXAMPLE");
      expect(result.categories).toContain("secret");
    });

    it("detects private keys", () => {
      const result = detect("-----BEGIN RSA PRIVATE KEY-----");
      expect(result.categories).toContain("secret");
    });

    it("detects passwords", () => {
      const result = detect('password = "SuperSecret123!"');
      expect(result.categories).toContain("secret");
    });

    // Tests with a real token generated from jwt.io
    it("detects JWT tokens", () => {
      const result = detect(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30", // gitleaks:allow
      );
      expect(result.categories).toContain("secret");
    });
  });

  describe("HR data detection", () => {
    it("detects salary information", () => {
      const result = detect("Salary: 85000 EUR");
      expect(result.categories).toContain("hr_data");
    });

    it("detects German salary", () => {
      const result = detect("Gehalt: 65.000 EUR");
      expect(result.categories).toContain("hr_data");
    });
  });

  describe("Severity scoring", () => {
    it("returns 0 for clean text", () => {
      const result = detect("Hello, how are you?");
      expect(result.severityScore).toBe(0);
      expect(result.recommendation).toBe("allow");
    });

    it("returns high severity for secrets", () => {
      const result = detect("-----BEGIN RSA PRIVATE KEY-----");
      expect(result.severityScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendation).toBe("block");
    });

    it("returns medium severity for real emails", () => {
      const result = detect("Email: user@realcompany.com");
      expect(result.severityScore).toBeGreaterThanOrEqual(30);
      expect(result.recommendation).toBe("warn");
    });
  });

  describe("Custom patterns", () => {
    it("detects custom regex patterns", () => {
      const result = detect("Project ALPHA-2025 is confidential", [
        {
          id: "project-code",
          name: "Project Code",
          category: "custom_keyword",
          pattern: "ALPHA-\\d{4}",
          severity: 60,
        },
      ]);
      expect(result.categories).toContain("custom_keyword");
    });
  });

  describe("No false positives", () => {
    it("does not flag ordinary text", () => {
      const result = detect("The weather is nice today. Let's go for a walk.");
      expect(result.matches.length).toBe(0);
    });

    it("does not flag code without secrets", () => {
      const result = detect("function add(a, b) { return a + b; }");
      expect(result.matches.length).toBe(0);
    });
  });

  describe("Example / fictional data filtering", () => {
    // --- Domain allowlist ---
    it("does not flag RFC 2606 example.com addresses", () => {
      const result = detect("Contact john.doe@example.com for info");
      const emailMatches = result.matches.filter((m) => m.category === "email");
      expect(emailMatches.length).toBe(0);
    });

    it("does not flag example.org addresses", () => {
      const result = detect("Reach us at support@example.org");
      expect(result.matches.filter((m) => m.category === "email").length).toBe(0);
    });

    it("does not flag test.com addresses", () => {
      const result = detect("Send to alice@test.com and bob@test.com");
      expect(result.matches.filter((m) => m.category === "email").length).toBe(0);
    });

    it("does not flag test.de addresses", () => {
      const result = detect("Schreib an user@test.de");
      expect(result.matches.filter((m) => m.category === "email").length).toBe(0);
    });

    it("does not flag subdomains of example.com", () => {
      const result = detect("user@mail.example.com");
      expect(result.matches.filter((m) => m.category === "email").length).toBe(0);
    });

    it("does not flag emails with local part 'test'", () => {
      const result = detect("test@company.de ist kein echter Nutzer");
      expect(result.matches.filter((m) => m.category === "email").length).toBe(0);
    });

    // --- Known test credit card numbers ---
    it("does not flag Stripe Visa test card 4242424242424242", () => {
      const result = detect("Card: 4242 4242 4242 4242");
      expect(result.matches.filter((m) => m.category === "credit_card").length).toBe(0);
    });

    it("does not flag generic Visa test card 4111111111111111", () => {
      const result = detect("Kartennummer: 4111 1111 1111 1111");
      expect(result.matches.filter((m) => m.category === "credit_card").length).toBe(0);
    });

    it("does not flag Stripe Mastercard test card 5555555555554444", () => {
      const result = detect("5555 5555 5555 4444");
      expect(result.matches.filter((m) => m.category === "credit_card").length).toBe(0);
    });

    // --- Context signals ---
    it("allows (score < 30) when German 'z.B.' context is present", () => {
      const result = detect("z.B. user@realcompany.com für die Demo");
      expect(result.severityScore).toBeLessThan(30);
      expect(result.recommendation).toBe("allow");
    });

    it("allows (score < 30) when English 'e.g.' context is present", () => {
      const result = detect("e.g. user@realcompany.com as a sample");
      expect(result.severityScore).toBeLessThan(30);
      expect(result.recommendation).toBe("allow");
    });

    it("allows when 'Beispiel' context is present", () => {
      const result = detect("Beispiel: user@realcompany.com");
      expect(result.severityScore).toBeLessThan(30);
    });

    it("allows when 'dummy' context is present", () => {
      const result = detect("dummy data: user@realcompany.com");
      expect(result.severityScore).toBeLessThan(30);
    });

    it("still warns for real email without example context", () => {
      const result = detect("Bitte schreib an user@realcompany.com");
      expect(result.severityScore).toBeGreaterThanOrEqual(30);
      expect(result.recommendation).toBe("warn");
    });

    it("still blocks secrets even with example context keyword nearby", () => {
      // A private key is so high severity (95) that even 0.8 * 0.3 * 95 ≈ 22.8
      // falls below warn — but this tests that the context window is bounded and
      // a distant example marker doesn't suppress a genuinely embedded secret.
      const farContext =
        "z.B. zeige ich hier etwas " + "a".repeat(200) + " -----BEGIN RSA PRIVATE KEY-----";
      const result = detect(farContext);
      // The keyword is > 150 chars away, so context should NOT reduce confidence
      expect(result.severityScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendation).toBe("block");
    });
  });
});
