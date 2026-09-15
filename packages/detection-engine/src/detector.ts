import type {
  DetectionCategory,
  DetectionMatch,
  DetectionResult,
  CustomPattern,
} from "@ai-compliance/shared-types";
import {
  BUILT_IN_RULES,
  PATTERN_ONLY_CONFIDENCE,
  VALIDATED_CONFIDENCE,
  type DetectionRule,
} from "./rules";

// ── Overlap resolution ───────────────────────────────────────────────────────

/**
 * When two matches overlap in the source text, keep only the higher-priority
 * one.  Priority: effective severity (rule severity × confidence) descending,
 * then span length descending (longer match wins ties).
 *
 * This prevents structural false-positives such as the phone-number regex
 * matching a digit run inside an IBAN or credit-card number.
 */
function resolveOverlappingMatches(matches: DetectionMatch[]): DetectionMatch[] {
  type Positioned = DetectionMatch & { start: number; end: number };

  const positioned = matches.filter(
    (m): m is Positioned => m.start !== undefined && m.end !== undefined,
  );
  const floating = matches.filter((m) => m.start === undefined || m.end === undefined);

  if (positioned.length <= 1) return matches;

  // Effective severity so lower-confidence matches lose to structural rules
  const effectiveSev = (m: Positioned): number => {
    const rule = BUILT_IN_RULES.find((r) => r.id === m.ruleId);
    return (rule?.severity ?? 30) * (m.confidence ?? PATTERN_ONLY_CONFIDENCE);
  };

  // Sort: highest severity first, then longest span first
  const sorted = [...positioned].sort((a, b) => {
    const diff = effectiveSev(b) - effectiveSev(a);
    if (diff !== 0) return diff;
    return b.end - b.start - (a.end - a.start);
  });

  const kept: Positioned[] = [];
  for (const m of sorted) {
    const overlaps = kept.some((k) => m.start < k.end && m.end > k.start);
    if (!overlaps) kept.push(m);
  }

  return [...kept, ...floating];
}

/**
 * Confidence multiplier applied when the match appears inside an example or
 * fictional context.  0.3 is low enough to drop any category below the "warn"
 * threshold (severity * 0.3 * 0.8 < 30 for all built-in rules ≤ 95).
 */
const EXAMPLE_CONTEXT_CONFIDENCE_FACTOR = 0.3;

/**
 * Patterns that indicate the surrounding text is describing example / dummy /
 * fictional data rather than real sensitive content.
 */
const EXAMPLE_CONTEXT_PATTERNS: RegExp[] = [
  // German
  /\b(?:z\.?\s?[Bb]\.?|zum\s+Beispiel|Beispiel|Beispieldaten|Muster(?:daten)?|Platzhalter|fiktiv|gefälscht|Testdaten?|Testwert)\b/i,
  // English
  /\b(?:e\.?\s?g\.?|for\s+example|example|sample|dummy|placeholder|fictional|fake|mock|test\s*data|test\s*value)\b/i,
  // Code lorem ipsum / placeholder names
  /\b(?:lorem|ipsum|foo|bar|baz|qux|quux|placeholder|noreply)\b/i,
];

/** How many characters of surrounding text to inspect for context signals. */
const CONTEXT_WINDOW = 150;

/**
 * Returns true when the region [start, end] in `text` is surrounded by
 * language that signals the data is fictional / exemplary.
 */
function hasExampleContext(text: string, start: number, end: number): boolean {
  const ctxStart = Math.max(0, start - CONTEXT_WINDOW);
  const ctxEnd = Math.min(text.length, end + CONTEXT_WINDOW);
  const context = text.slice(ctxStart, ctxEnd);
  return EXAMPLE_CONTEXT_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(context);
  });
}

/**
 * Main detection engine.
 * Runs all rules against input text and produces a structured result.
 */
export function detect(
  text: string,
  customPatterns: CustomPattern[] = [],
  customKeywords: string[] = [],
): DetectionResult {
  const matches: DetectionMatch[] = [];

  // Run built-in rules
  for (const rule of BUILT_IN_RULES) {
    const ruleMatches = runRule(text, rule);
    matches.push(...ruleMatches);
  }

  // Run custom regex patterns
  for (const cp of customPatterns) {
    try {
      const regex = new RegExp(cp.pattern, "gi");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        matches.push({
          category: cp.category,
          ruleId: `custom-${cp.id}`,
          matchedText: m[0],
          start: m.index,
          end: m.index + m[0].length,
          confidence: 0.8,
        });
      }
    } catch (err) {
      // Invalid regex — skip pattern but surface the failure for operators.
      console.warn(
        `[detection-engine] invalid custom pattern id=${cp.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Run custom keywords
  if (customKeywords.length > 0) {
    const lowerText = text.toLowerCase();
    for (const keyword of customKeywords) {
      const lowerKw = keyword.toLowerCase();
      let idx = lowerText.indexOf(lowerKw);
      while (idx !== -1) {
        matches.push({
          category: "custom_keyword",
          ruleId: `keyword-${keyword}`,
          matchedText: text.slice(idx, idx + keyword.length),
          start: idx,
          end: idx + keyword.length,
          confidence: 1.0,
        });
        idx = lowerText.indexOf(lowerKw, idx + 1);
      }
    }
  }

  // Deduplicate by exact position, then resolve structural overlaps
  const deduped = resolveOverlappingMatches(deduplicateMatches(matches));

  // Compute categories
  const categories = [...new Set(deduped.map((m) => m.category))];

  // Compute severity
  const severityScore = computeSeverity(deduped);

  // Compute recommendation
  const recommendation = severityScore >= 70 ? "block" : severityScore >= 30 ? "warn" : "allow";

  // Compute reasons
  const reasons = categories.map(
    (cat) =>
      `Detected ${cat} (${deduped.filter((m) => m.category === cat).length} match${deduped.filter((m) => m.category === cat).length > 1 ? "es" : ""})`,
  );

  return {
    categories,
    matches: deduped,
    severityScore,
    recommendation,
    reasons,
  };
}

/**
 * Confidence is a 0..1 probability. Rule validators are an extension point, so
 * guard against values outside that range rather than letting them distort the
 * severity score.
 */
function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return PATTERN_ONLY_CONFIDENCE;
  return Math.min(Math.max(value, 0), 1);
}

function runRule(text: string, rule: DetectionRule): DetectionMatch[] {
  const matches: DetectionMatch[] = [];
  // Reset regex state
  const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const matched = m[0];
    const start = m.index;
    const end = start + matched.length;

    // Run optional validator (e.g. Luhn check, known test domain filter).
    // A validator may also report the confidence for this specific match —
    // rules whose checksum covers only part of what their pattern matches use
    // that to avoid claiming validated confidence for the unchecked remainder.
    let baseConfidence = PATTERN_ONLY_CONFIDENCE;
    if (rule.validate) {
      const result = rule.validate(matched);
      if (typeof result === "boolean") {
        if (!result) continue;
        baseConfidence = VALIDATED_CONFIDENCE;
      } else {
        if (!result.valid) continue;
        baseConfidence = clampConfidence(result.confidence ?? VALIDATED_CONFIDENCE);
      }
    }

    // Reduce confidence when the match is surrounded by example/dummy language
    const confidence = hasExampleContext(text, start, end)
      ? baseConfidence * EXAMPLE_CONTEXT_CONFIDENCE_FACTOR
      : baseConfidence;

    matches.push({
      category: rule.category,
      ruleId: rule.id,
      matchedText: matched,
      start,
      end,
      confidence,
    });
  }

  return matches;
}

function deduplicateMatches(matches: DetectionMatch[]): DetectionMatch[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = `${m.category}:${m.start}:${m.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeSeverity(matches: DetectionMatch[]): number {
  if (matches.length === 0) return 0;

  // Effective severity = rule severity × confidence so that example-context
  // matches and low-confidence custom patterns don't trigger blocks.
  const effectiveSeverities = matches.map((m) => {
    const rule = BUILT_IN_RULES.find((r) => r.id === m.ruleId);
    const baseSeverity = rule?.severity ?? 30;
    const confidence = m.confidence ?? PATTERN_ONLY_CONFIDENCE;
    return baseSeverity * confidence;
  });

  const maxSeverity = Math.max(...effectiveSeverities);
  const volumeBonus = Math.min((matches.length - 1) * 5, 20);

  return Math.min(Math.round(maxSeverity + volumeBonus), 100);
}

export type { DetectionRule };
