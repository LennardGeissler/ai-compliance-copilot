// ============================================================
// AI Compliance Copilot — Shared Types
// ============================================================

// --- Detection ---

export type DetectionCategory =
  | "email"
  | "phone"
  | "iban"
  | "credit_card"
  | "swift_bic"
  | "address"
  | "customer_id"
  | "employee_id"
  | "secret"
  | "hr_data"
  | "custom_keyword";

export interface DetectionMatch {
  category: DetectionCategory;
  ruleId: string;
  matchedText?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

export interface DetectionResult {
  categories: DetectionCategory[];
  matches: DetectionMatch[];
  severityScore: number;
  recommendation: PolicyAction;
  reasons: string[];
}

// --- Policy ---

export type PolicyAction = "allow" | "warn" | "block";

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  action: PolicyAction;
  categories?: DetectionCategory[];
  tools?: string[];
  minSeverityScore?: number;
  customRuleIds?: string[];
  userMessage?: string;
}

export interface PolicyEvaluationResult {
  finalAction: PolicyAction;
  matchedPolicyIds: string[];
  userMessage?: string;
  reasons: string[];
}

// --- Tool ---

export interface SupportedTool {
  id: string;
  key: string;
  displayName: string;
  domain: string;
  isSupported: boolean;
}

export const SUPPORTED_TOOLS: SupportedTool[] = [
  {
    id: "chatgpt",
    key: "chatgpt",
    displayName: "ChatGPT",
    domain: "chatgpt.com",
    isSupported: true,
  },
  {
    id: "chatgpt-legacy",
    key: "chatgpt",
    displayName: "ChatGPT (Legacy)",
    domain: "chat.openai.com",
    isSupported: true,
  },
  { id: "claude", key: "claude", displayName: "Claude", domain: "claude.ai", isSupported: true },
  {
    id: "gemini",
    key: "gemini",
    displayName: "Gemini",
    domain: "gemini.google.com",
    isSupported: true,
  },
  {
    id: "perplexity",
    key: "perplexity",
    displayName: "Perplexity",
    domain: "perplexity.ai",
    isSupported: true,
  },
];

// --- Usage Event ---

export interface UsageEvent {
  organizationId: string;
  userId: string;
  toolId: string;
  domain: string;
  timestamp: string;
  clientVersion: string;
  browser: string;
}

// --- Incident ---

export type IncidentStatus = "open" | "reviewed" | "resolved" | "dismissed";
export type IncidentAction = "warn" | "block" | "allow_after_warning";

export interface Incident {
  id?: string;
  organizationId: string;
  userId: string;
  toolId: string;
  domain: string;
  actionTaken: IncidentAction;
  categories: DetectionCategory[];
  severityScore: number;
  matchedPolicyIds: string[];
  status: IncidentStatus;
  redactedPreview?: string | null;
  timestamp: string;
  clientVersion: string;
  browser: string;
}

// --- Prompt Library ---

export interface Prompt {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
}

// --- Extension Config ---

export interface ExtensionConfig {
  policies: Policy[];
  customPatterns: CustomPattern[];
  companyPrompts?: Prompt[];
  settings: {
    storeRedactedPreview: boolean;
    enabledTools: string[];
  };
}

export interface CustomPattern {
  id: string;
  name: string;
  category: DetectionCategory;
  pattern: string; // regex string
  severity: number;
}

// --- Dashboard ---

export interface DashboardOverview {
  totalUsageEvents: number;
  totalIncidents: number;
  incidentsBySeverity: Record<string, number>;
  incidentsByTool: Record<string, number>;
  topCategories: { category: string; count: number }[];
  complianceScore: number;
  recentIncidents: Incident[];
}

// --- Compliance Score ---

export interface ComplianceScoreBreakdown {
  score: number;
  deductions: { reason: string; points: number }[];
  bonuses: { reason: string; points: number }[];
}

// --- API ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Site Adapter ---

export interface AdapterContext {
  toolId: string;
  domain: string;
  onBeforeSend: (
    text: string,
  ) => Promise<{ allowed: boolean; action?: PolicyAction; result?: PolicyEvaluationResult }>;
}

export interface SiteAdapter {
  id: string;
  matches(url: string): boolean;
  findInputElement(): HTMLElement | null;
  findSendButton(): HTMLElement | null;
  extractText(input: HTMLElement): string;
  setInputText(text: string): void;
  installHooks(ctx: AdapterContext): void;
  destroy(): void;
}
