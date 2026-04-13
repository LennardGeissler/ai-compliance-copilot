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

  describe("SWIFT/BIC detection", () => {
    it("detects 8-character SWIFT/BIC codes", () => {
      const result = detect("Bank code: DEUTDEFF");
      expect(result.categories).toContain("swift_bic");
    });

    it("detects 11-character SWIFT/BIC codes with branch", () => {
      const result = detect("SWIFT: DEUTDEFF500");
      expect(result.categories).toContain("swift_bic");
    });

    it("detects SWIFT/BIC in full bank wire details", () => {
      const result = detect("Recipient bank: INGBNL2AXXX");
      expect(result.categories).toContain("swift_bic");
    });

    it("does not flag ordinary text as SWIFT/BIC", () => {
      const result = detect("The meeting is scheduled for tomorrow at 2pm.");
      expect(result.categories).not.toContain("swift_bic");
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
