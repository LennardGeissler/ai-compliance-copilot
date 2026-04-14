import type {
  AdapterContext,
  PolicyAction,
  PolicyEvaluationResult,
  ExtensionConfig,
  IncidentAction,
  SiteAdapter,
} from "@ai-compliance/shared-types";
import { detect } from "@ai-compliance/detection-engine";
import { evaluatePolicies } from "@ai-compliance/policy-engine";
import { getAdapterForUrl } from "./adapters";
import { showOverlay } from "./overlay/overlay";

const CLIENT_VERSION = "0.1.0";
const CONFIG_LOAD_TIMEOUT_MS = 3000;

const FALLBACK_CONFIG: ExtensionConfig = {
  policies: [],
  customPatterns: [],
  settings: {
    storeRedactedPreview: false,
    enabledTools: ["chatgpt", "claude", "gemini", "perplexity"],
  },
};

let config: ExtensionConfig | null = null;
/** Module-level adapter reference — needed to set input text for redacted sends. */
let currentAdapter: SiteAdapter | null = null;
/** Current UI theme, read from storage once on init. */
let currentTheme: "light" | "dark" = "dark";
/** True once init() has completed — gates handlers that depend on adapter/config. */
let isInitialized = false;

/**
 * Initialize the content script.
 * Detects which AI tool is active, loads config, and installs hooks.
 */
async function init() {
  const url = window.location.href;
  const adapter = getAdapterForUrl(url);

  if (!adapter) return; // Not on a supported site

  currentAdapter = adapter;

  // Load theme preference
  const stored = await chrome.storage.local.get("theme");
  currentTheme = stored.theme === "light" ? "light" : "dark";

  // Load config from background
  config = await loadConfig();

  // Report usage event
  reportUsageEvent(adapter.id, window.location.hostname);

  // Set up adapter context
  const ctx: AdapterContext = {
    toolId: adapter.id,
    domain: window.location.hostname,
    onBeforeSend: (text: string) => handleBeforeSend(text, adapter.id),
  };

  adapter.installHooks(ctx);
  isInitialized = true;
}

async function loadConfig(): Promise<ExtensionConfig> {
  const request = new Promise<ExtensionConfig>((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (response) => {
      resolve(response?.config ?? FALLBACK_CONFIG);
    });
  });
  const timeout = new Promise<ExtensionConfig>((resolve) => {
    setTimeout(() => resolve(FALLBACK_CONFIG), CONFIG_LOAD_TIMEOUT_MS);
  });
  return Promise.race([request, timeout]);
}

async function handleBeforeSend(
  text: string,
  toolId: string,
): Promise<{
  allowed: boolean;
  action?: PolicyAction;
  result?: PolicyEvaluationResult;
}> {
  // Guard: if init() hasn't finished yet, adapter/config may be incomplete.
  // Fail open (same posture as the fallback config) rather than crash.
  if (!isInitialized || !currentAdapter) {
    return { allowed: true };
  }

  // Run detection
  const detectionResult = detect(text, config?.customPatterns ?? [], []);

  // If nothing detected, allow
  if (detectionResult.matches.length === 0) {
    return { allowed: true };
  }

  // Run policy evaluation
  const policyResult = evaluatePolicies(detectionResult, config?.policies ?? [], toolId);

  if (policyResult.finalAction === "allow") {
    return { allowed: true };
  }

  // Show overlay and wait for user decision
  return new Promise((resolve) => {
    showOverlay({
      action: policyResult.finalAction,
      categories: detectionResult.categories,
      reasons: policyResult.reasons,
      userMessage: policyResult.userMessage,
      // Pass raw text + matches so the overlay can compute the redacted version
      originalText: text,
      matches: detectionResult.matches,
      theme: currentTheme,

      onContinue: () => {
        reportIncident(
          toolId,
          "allow_after_warning",
          detectionResult.categories,
          detectionResult.severityScore,
          policyResult.matchedPolicyIds,
        );
        resolve({ allowed: true, action: "warn", result: policyResult });
      },

      onGoBack: () => {
        const action: IncidentAction = policyResult.finalAction === "block" ? "block" : "warn";
        reportIncident(
          toolId,
          action,
          detectionResult.categories,
          detectionResult.severityScore,
          policyResult.matchedPolicyIds,
        );
        resolve({
          allowed: false,
          action: policyResult.finalAction,
          result: policyResult,
        });
      },

      onSendRedacted: (redactedText: string) => {
        // Put the sanitised text into the input field, then let the adapter
        // re-dispatch the send event via the resolved promise.
        currentAdapter?.setInputText(redactedText);
        reportIncident(
          toolId,
          "allow_after_warning",
          detectionResult.categories,
          detectionResult.severityScore,
          policyResult.matchedPolicyIds,
        );
        resolve({ allowed: true, action: policyResult.finalAction, result: policyResult });
      },
    });
  });
}

function reportUsageEvent(toolId: string, domain: string) {
  chrome.runtime.sendMessage({
    type: "USAGE_EVENT",
    payload: {
      toolId,
      domain,
      timestamp: new Date().toISOString(),
      clientVersion: CLIENT_VERSION,
      browser: navigator.userAgent,
    },
  });
}

function reportIncident(
  toolId: string,
  actionTaken: IncidentAction,
  categories: string[],
  severityScore: number,
  matchedPolicyIds: string[],
) {
  chrome.runtime.sendMessage({
    type: "INCIDENT",
    payload: {
      toolId,
      domain: window.location.hostname,
      actionTaken,
      categories,
      severityScore,
      matchedPolicyIds,
      timestamp: new Date().toISOString(),
      clientVersion: CLIENT_VERSION,
      browser: navigator.userAgent,
    },
  });
}

// ── Prompt insertion ──────────────────────────────────────────────────────────

/**
 * Listens for INSERT_PROMPT messages forwarded by the background service.
 * The popup sends these when the user clicks "Verwenden" on a prompt.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "INSERT_PROMPT") {
    if (currentAdapter) {
      currentAdapter.setInputText(message.payload.content as string);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "No active adapter" });
    }
    return true;
  }
});

// Keep currentTheme in sync when the user toggles it in the popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["theme"]) {
    const newTheme = changes["theme"].newValue;
    currentTheme = newTheme === "light" ? "light" : "dark";
  }
});

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
