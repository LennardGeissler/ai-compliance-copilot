import type { PolicyAction, DetectionCategory, DetectionMatch } from "@ai-compliance/shared-types";
import { buildRedactedText } from "@ai-compliance/detection-engine";
import { t } from "../i18n";

export interface OverlayOptions {
  action: PolicyAction;
  categories: DetectionCategory[];
  reasons: string[];
  userMessage?: string;
  /** Original text the user tried to send — required for auto-redaction. */
  originalText?: string;
  /** Full match list from the detection engine — required for auto-redaction. */
  matches?: DetectionMatch[];
  /** Visual theme to apply to the overlay card. Defaults to "dark". */
  theme?: "light" | "dark";
  onContinue?: () => void;
  onGoBack?: () => void;
  /** Called with the (possibly user-edited) sanitised text when the user
   *  chooses "Bereinigt senden". */
  onSendRedacted?: (redactedText: string) => void;
}

// ── Labels ──────────────────────────────────────────────────────────────────

const CATEGORY_KEYS = new Set([
  "email",
  "phone",
  "iban",
  "internal_ip",
  "credit_card",
  "address",
  "customer_id",
  "employee_id",
  "secret",
  "hr_data",
  "custom_keyword",
]);

function categoryLabel(cat: string): string {
  if (!CATEGORY_KEYS.has(cat)) return t("category_unknown");
  return t(`category_${cat}`);
}

function categoryExplanation(cat: string): { risk: string; action: string } {
  if (!CATEGORY_KEYS.has(cat)) {
    return { risk: t("category_unknown_risk"), action: t("category_unknown_action") };
  }
  return { risk: t(`category_${cat}_risk`), action: t(`category_${cat}_action`) };
}

// ── Category icons (Lucide-style inline SVG) ────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  email: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>`,

  phone: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12
      19.79 19.79 0 0 1 1.08 3.18 2 2 0 0 1 3.07 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7
      2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45
      c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16l.92.92z"/>
  </svg>`,

  iban: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>`,

  internal_ip: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
    <rect x="8" y="3" width="8" height="4" rx="1"/>
    <line x1="12" y1="7" x2="12" y2="11"/>
    <line x1="9" y1="10" x2="9.01" y2="10"/>
    <line x1="15" y1="10" x2="15.01" y2="10"/>
  </svg>`,

  credit_card: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>`,

  address: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>`,

  customer_id: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 12h.01M12 12h.01M8 12h.01"/>
  </svg>`,

  employee_id: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`,

  secret: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0
      0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>`,

  hr_data: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,

  custom_keyword: `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
};

const FALLBACK_ICON = `<svg class="acc-overlay-tag-icon" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="8" x2="12" y2="12"/>
  <line x1="12" y1="16" x2="12.01" y2="16"/>
</svg>`;

// ── Shield icons ─────────────────────────────────────────────────────────────

const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <line x1="12" y1="8" x2="12" y2="13"/>
  <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/>
</svg>`;

const ICON_BLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <line x1="9.5" y1="9.5" x2="14.5" y2="14.5"/>
  <line x1="14.5" y1="9.5" x2="9.5" y2="14.5"/>
</svg>`;

const ICON_FOOTER = `<svg class="acc-overlay-footer-icon" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
</svg>`;

const ICON_CHEVRON = `<svg class="acc-overlay-reasons-chevron" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

const ICON_WAND = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
  style="flex-shrink:0;">
  <path d="m15 4-1 1"/>
  <path d="m14 9 2-2"/>
  <path d="M10.5 3.5 9 5"/>
  <path d="m3 3 18 18"/>
  <path d="m3 21 4.5-4.5"/>
  <path d="M4.5 9 6 7.5"/>
  <path d="M9 4.5 7.5 6"/>
  <path d="m15 15-6-6"/>
</svg>`;

// ── Cleanup state ────────────────────────────────────────────────────────────

/** Active ESC handler — stored so it can be cleaned up on any dismissal path. */
let activeEscHandler: ((e: KeyboardEvent) => void) | null = null;

// ── Main ─────────────────────────────────────────────────────────────────────

export function showOverlay(options: OverlayOptions): void {
  removeOverlay();

  const isBlock = options.action === "block";
  const variant = isBlock ? "block" : "warn";

  const title = isBlock ? t("overlay_title_blocked") : t("overlay_title_warning");
  const risk = isBlock ? t("overlay_risk_critical") : t("overlay_risk_high");
  const message =
    options.userMessage ??
    (isBlock ? t("overlay_default_block_message") : t("overlay_default_warn_message"));

  // Category tags
  const categoryTags = options.categories
    .map((cat) => {
      const icon = CATEGORY_ICONS[cat] ?? FALLBACK_ICON;
      const label = escapeHtml(categoryLabel(cat));
      return `<span class="acc-overlay-tag">${icon}${label}</span>`;
    })
    .join("");

  // Structured explanations per detected category
  const explanationsHtml = options.categories.length
    ? `
    <div class="acc-overlay-reasons">
      <button class="acc-overlay-reasons-toggle" aria-expanded="false" id="acc-reasons-toggle">
        ${escapeHtml(t("overlay_why_blocked"))}
        ${ICON_CHEVRON}
      </button>
      <div class="acc-overlay-reasons-body" id="acc-reasons-body">
        ${options.categories
          .map((cat) => {
            const exp = categoryExplanation(cat);
            const label = escapeHtml(categoryLabel(cat));
            const icon = CATEGORY_ICONS[cat] ?? FALLBACK_ICON;
            return `
            <div class="acc-overlay-explanation">
              <div class="acc-overlay-explanation-header">
                ${icon}
                <span>${label}</span>
              </div>
              <p class="acc-overlay-explanation-risk">${escapeHtml(exp.risk)}</p>
              <div class="acc-overlay-explanation-action">
                <span class="acc-overlay-explanation-action-label">${escapeHtml(t("overlay_recommendation_label"))}</span>
                ${escapeHtml(exp.action)}
              </div>
            </div>`;
          })
          .join("")}
        ${
          options.reasons.length
            ? `
          <div class="acc-overlay-policy-reasons">
            <span class="acc-overlay-policy-reasons-label">${escapeHtml(t("overlay_triggered_policies"))}</span>
            <ul>${options.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
          </div>`
            : ""
        }
      </div>
    </div>`
    : "";

  // Redaction preview (initially hidden, shown when user clicks "Text anonymisieren")
  const canRedact = !!options.originalText && !!options.matches?.length;
  const redactSectionHtml = canRedact
    ? `
    <div class="acc-overlay-redact" id="acc-overlay-redact" style="display:none;">
      <div class="acc-overlay-section-label">${escapeHtml(t("overlay_redact_section_label"))}</div>
      <p class="acc-overlay-redact-hint">
        ${escapeHtml(t("overlay_redact_hint"))}
      </p>
      <textarea class="acc-overlay-redact-textarea" id="acc-overlay-redact-text" rows="5"
        aria-label="${escapeHtml(t("overlay_redact_textarea_aria"))}"></textarea>
    </div>`
    : "";

  // Shared redact buttons snippet (used in both warn and block layouts)
  const redactBtnsHtml = canRedact
    ? `
    <button class="acc-overlay-btn acc-overlay-btn--redact" id="acc-overlay-anonymize">
      ${ICON_WAND}
      ${escapeHtml(t("overlay_btn_anonymize"))}
    </button>
    <button class="acc-overlay-btn acc-overlay-btn--send-redacted" id="acc-overlay-send-redacted"
      style="display:none;">
      ${escapeHtml(t("overlay_btn_send_redacted"))}
    </button>`
    : "";

  // Action buttons — layout depends on mode and redaction availability
  const actionsHtml = isBlock
    ? `
    ${redactBtnsHtml}
    <div class="acc-overlay-actions-row">
      <button class="acc-overlay-btn acc-overlay-btn--block" id="acc-overlay-back">
        ${escapeHtml(t("overlay_btn_back"))}
      </button>
      <button class="acc-overlay-btn acc-overlay-btn--override" id="acc-overlay-continue">
        ${escapeHtml(t("overlay_btn_override_send"))}
      </button>
    </div>`
    : `
    ${redactBtnsHtml}
    <div class="acc-overlay-actions-row">
      <button class="acc-overlay-btn acc-overlay-btn--secondary" id="acc-overlay-back">
        ${escapeHtml(t("overlay_btn_back"))}
      </button>
      <button class="acc-overlay-btn acc-overlay-btn--warn" id="acc-overlay-continue">
        ${escapeHtml(t("overlay_btn_send_anyway"))}
      </button>
    </div>`;

  const backdrop = document.createElement("div");
  backdrop.id = "acc-overlay";
  backdrop.className = "acc-overlay-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "acc-overlay-title");
  if (options.theme === "light") {
    backdrop.setAttribute("data-theme", "light");
  }

  backdrop.innerHTML = `
    <div class="acc-overlay-card acc-overlay-card--${variant}">

      <div class="acc-overlay-bar"></div>

      <div class="acc-overlay-hero">
        <div class="acc-overlay-icon-wrap">
          <div class="acc-overlay-icon-glow"></div>
          <div class="acc-overlay-icon">${isBlock ? ICON_BLOCK : ICON_WARN}</div>
        </div>
        <div class="acc-overlay-risk">
          <span class="acc-overlay-risk-dot"></span>
          ${escapeHtml(risk)}
        </div>
        <h2 class="acc-overlay-title" id="acc-overlay-title">${escapeHtml(title)}</h2>
        <p class="acc-overlay-message">${escapeHtml(message)}</p>
      </div>

      <div class="acc-overlay-body">
        ${
          categoryTags
            ? `
          <div class="acc-overlay-section-label">${escapeHtml(t("overlay_section_detected_data"))}</div>
          <div class="acc-overlay-categories">${categoryTags}</div>
        `
            : ""
        }
        ${explanationsHtml}
        ${redactSectionHtml}
      </div>

      <div class="acc-overlay-actions">
        ${actionsHtml}
      </div>

      <div class="acc-overlay-footer">
        ${ICON_FOOTER}
        AI Compliance Copilot
      </div>

    </div>`;

  document.body.appendChild(backdrop);

  // Focus primary action
  (document.getElementById("acc-overlay-back") as HTMLElement | null)?.focus();

  // Collapsible explanations toggle
  document.getElementById("acc-reasons-toggle")?.addEventListener("click", () => {
    const toggle = document.getElementById("acc-reasons-toggle")!;
    const body = document.getElementById("acc-reasons-body")!;
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    body.classList.toggle("is-open", !open);
  });

  // Back / Go Back button
  document.getElementById("acc-overlay-back")?.addEventListener("click", () => {
    removeOverlay();
    options.onGoBack?.();
  });

  // Continue / Override button
  document.getElementById("acc-overlay-continue")?.addEventListener("click", () => {
    removeOverlay();
    options.onContinue?.();
  });

  // "Text anonymisieren" — compute redacted text and reveal preview
  if (canRedact) {
    document.getElementById("acc-overlay-anonymize")?.addEventListener("click", () => {
      const redacted = buildRedactedText(options.originalText!, options.matches!);
      const textarea = document.getElementById("acc-overlay-redact-text") as HTMLTextAreaElement;
      textarea.value = redacted;

      // Reveal preview section + "Bereinigt senden", hide anonymize button
      document.getElementById("acc-overlay-redact")!.style.display = "block";
      document.getElementById("acc-overlay-anonymize")!.style.display = "none";
      document.getElementById("acc-overlay-send-redacted")!.style.display = "flex";

      textarea.focus();
    });

    // "Bereinigt senden" — pass (possibly edited) redacted text back
    document.getElementById("acc-overlay-send-redacted")?.addEventListener("click", () => {
      const textarea = document.getElementById("acc-overlay-redact-text") as HTMLTextAreaElement;
      const finalText = textarea.value;
      removeOverlay();
      options.onSendRedacted?.(finalText);
    });
  }

  // Backdrop click — treat as go-back
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      removeOverlay();
      options.onGoBack?.();
    }
  });

  const onEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      removeOverlay();
      options.onGoBack?.();
    }
  };
  activeEscHandler = onEsc;
  document.addEventListener("keydown", onEsc);
}

export function removeOverlay(): void {
  document.getElementById("acc-overlay")?.remove();
  if (activeEscHandler) {
    document.removeEventListener("keydown", activeEscHandler);
    activeEscHandler = null;
  }
}

function escapeHtml(str: string): string {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
