import { SUPPORTED_TOOLS } from "@ai-compliance/shared-types";
import type { Prompt } from "@ai-compliance/shared-types";
import { t, hydrateI18n } from "../i18n";

const TOOL_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

function categoryLabel(cat: string): string {
  return t(`category_${cat}`);
}

interface Detection {
  categories: string[];
  toolId: string;
  actionTaken: string;
  timestamp: string;
}

interface Stats {
  detections: number;
  blocked: number;
  overridden: number;
}

// ── State ────────────────────────────────────────────────────────────────────

/** Currently edited personal prompt — null when creating a new one. */
let editingPromptId: string | null = null;
/** Original createdAt of the prompt being edited. */
let editingPromptCreatedAt: string = "";

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  hydrateI18n();
  initTabs();
  await initTheme();

  const versionEl = document.getElementById("versionLabel");
  if (versionEl) versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

  const { authToken, serverUrl } = await chrome.storage.local.get(["authToken", "serverUrl"]);

  setStatus(!!authToken);

  if (authToken) {
    document.getElementById("dashboardSection")!.style.display = "block";
    const btn = document.getElementById("dashboardBtn")!;
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: serverUrl || "http://localhost:3000" });
    });
  } else {
    document.getElementById("connectSection")!.style.display = "block";
    document.getElementById("connectBtn")!.addEventListener("click", handleConnect);
  }

  // Activity tab
  chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
    if (response?.stats) renderStats(response.stats);
    if (response?.recent) renderActivity(response.recent);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.url) return;
    const tool = SUPPORTED_TOOLS.find((t) => tab.url!.includes(t.domain));
    const toolEl = document.getElementById("currentTool")!;
    const badgeEl = document.getElementById("protectionBadge")!;

    if (tool) {
      toolEl.textContent = tool.displayName;
      badgeEl.className = "badge badge--active";
      badgeEl.innerHTML = `
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        ${escHtml(t("badge_active"))}
      `;
    } else {
      toolEl.textContent = t("current_tool_none");
    }
  });

  // Prompt tab
  loadPrompts();
  document.getElementById("addPromptBtn")!.addEventListener("click", openNewPromptForm);
  document.getElementById("promptSaveBtn")!.addEventListener("click", handleSavePrompt);
  document.getElementById("promptCancelBtn")!.addEventListener("click", closePromptForm);
}

// ── Theme ────────────────────────────────────────────────────────────────────

async function initTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  const active = theme === "light" ? "light" : "dark";
  applyTheme(active);

  document.getElementById("themeToggle")!.addEventListener("click", async () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    await chrome.storage.local.set({ theme: next });
  });
}

function applyTheme(theme: "light" | "dark") {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function initTabs() {
  const activityBtn = document.getElementById("tabActivityBtn")!;
  const promptsBtn = document.getElementById("tabPromptsBtn")!;
  const activityPanel = document.getElementById("tabActivity")!;
  const promptsPanel = document.getElementById("tabPrompts")!;

  activityBtn.addEventListener("click", () => {
    activityBtn.classList.add("is-active");
    promptsBtn.classList.remove("is-active");
    activityPanel.classList.add("is-active");
    promptsPanel.classList.remove("is-active");
  });

  promptsBtn.addEventListener("click", () => {
    promptsBtn.classList.add("is-active");
    activityBtn.classList.remove("is-active");
    promptsPanel.classList.add("is-active");
    activityPanel.classList.remove("is-active");
    loadPrompts();
  });
}

// ── Activity tab ─────────────────────────────────────────────────────────────

function setStatus(connected: boolean) {
  const card = document.getElementById("statusCard")!;
  const dot = document.getElementById("pingDot")!;
  const ring = document.getElementById("pingRing")!;
  const text = document.getElementById("statusText")!;

  const state = connected ? "active" : "inactive";
  card.className = `status-card status-card--${state}`;
  dot.className = `ping-dot  ping-dot--${state}`;
  ring.className = `ping-ring ping-ring--${state}`;
  text.className = `status-text status-text--${state}`;
  text.textContent = connected ? t("status_connected") : t("status_disconnected");
}

function renderStats(stats: Stats) {
  document.getElementById("statTotal")!.textContent = String(stats.detections);
  document.getElementById("statBlocked")!.textContent = String(stats.blocked);
  document.getElementById("statOverride")!.textContent = String(stats.overridden);
}

function renderActivity(detections: Detection[]) {
  const container = document.getElementById("activityList")!;

  if (detections.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
             stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
        <div class="empty-state-text">${escHtml(t("empty_no_detections"))}<br>${escHtml(t("empty_session_clean"))}</div>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="activity-list">${detections
    .slice(0, 5)
    .map((d) => renderItem(d))
    .join("")}</div>`;
}

function renderItem(d: Detection): string {
  const cats = d.categories.map((c) => categoryLabel(c)).join(", ");

  const toolLabel = TOOL_LABELS[d.toolId] ?? d.toolId;
  const age = timeAgo(d.timestamp);

  const dotClass = actionDotClass(d.actionTaken);
  const actionClass = actionBadgeClass(d.actionTaken);
  const actionLabel = actionText(d.actionTaken);

  return `
    <div class="activity-item">
      <div class="activity-dot ${dotClass}"></div>
      <div class="activity-body">
        <div class="activity-cats">${escHtml(cats)}</div>
        <div class="activity-meta">
          <span class="activity-action ${actionClass}">${actionLabel}</span>
          ${escHtml(toolLabel)} · ${age}
        </div>
      </div>
    </div>`;
}

function actionDotClass(action: string): string {
  if (action === "block") return "activity-dot--block";
  if (action === "allow_after_warning") return "activity-dot--override";
  return "activity-dot--warn";
}

function actionBadgeClass(action: string): string {
  if (action === "block") return "activity-action--block";
  if (action === "allow_after_warning") return "activity-action--override";
  return "activity-action--warn";
}

function actionText(action: string): string {
  if (action === "block") return t("action_blocked");
  if (action === "allow_after_warning") return t("action_override");
  return t("action_warning");
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

async function handleConnect() {
  const serverUrl = (document.getElementById("serverUrl") as HTMLInputElement).value.trim();
  const token = (document.getElementById("tokenInput") as HTMLInputElement).value.trim();
  if (!token) return;

  await chrome.storage.local.set({
    authToken: token,
    serverUrl: serverUrl || "http://localhost:3000",
  });

  setStatus(true);
  document.getElementById("connectSection")!.style.display = "none";
  document.getElementById("dashboardSection")!.style.display = "block";
}

// ── Prompt Library tab ───────────────────────────────────────────────────────

function loadPrompts() {
  chrome.runtime.sendMessage({ type: "GET_PROMPTS" }, (response) => {
    renderCompanyPrompts((response?.company ?? []) as Prompt[]);
    renderPersonalPrompts((response?.personal ?? []) as Prompt[]);
  });
}

function renderCompanyPrompts(prompts: Prompt[]) {
  const container = document.getElementById("companyPromptsList")!;
  const section = document.getElementById("companyPromptsSection")!;

  if (prompts.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = `<div class="prompt-list">${prompts
    .map((p) => renderPromptCard(p, false))
    .join("")}</div>`;

  // Bind use buttons
  prompts.forEach((p) => {
    document.getElementById(`use-${p.id}`)?.addEventListener("click", () => insertPrompt(p));
  });
}

function renderPersonalPrompts(prompts: Prompt[]) {
  const container = document.getElementById("personalPromptsList")!;

  if (prompts.length === 0) {
    container.innerHTML = `
      <div class="prompt-empty">
        ${escHtml(t("prompts_empty_line1"))}<br>
        ${t("prompts_empty_line2")}
      </div>`;
    return;
  }

  container.innerHTML = `<div class="prompt-list">${prompts
    .map((p) => renderPromptCard(p, true))
    .join("")}</div>`;

  // Bind use + delete + edit buttons
  prompts.forEach((p) => {
    document.getElementById(`use-${p.id}`)?.addEventListener("click", () => insertPrompt(p));
    document.getElementById(`delete-${p.id}`)?.addEventListener("click", () => deletePrompt(p.id));
    document.getElementById(`edit-${p.id}`)?.addEventListener("click", () => openEditPromptForm(p));
  });
}

function renderPromptCard(p: Prompt, personal: boolean): string {
  const preview = escHtml(p.content.length > 80 ? p.content.slice(0, 80) + "…" : p.content);
  const useLabel = escHtml(t("btn_use"));
  const editTitle = escHtml(t("btn_edit_title"));
  const deleteTitle = escHtml(t("btn_delete_title"));
  const controls = personal
    ? `<button class="prompt-use-btn"    id="use-${escHtml(p.id)}">${useLabel}</button>
       <button class="prompt-delete-btn" id="edit-${escHtml(p.id)}" title="${editTitle}">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
           <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
         </svg>
       </button>
       <button class="prompt-delete-btn" id="delete-${escHtml(p.id)}" title="${deleteTitle}">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <polyline points="3 6 5 6 21 6"/>
           <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
           <path d="M10 11v6M14 11v6"/>
           <path d="M9 6V4h6v2"/>
         </svg>
       </button>`
    : `<button class="prompt-use-btn" id="use-${escHtml(p.id)}">${useLabel}</button>`;

  const badge = personal
    ? ""
    : `<span class="prompt-company-badge">${escHtml(t("badge_company"))}</span>`;

  return `
    <div class="prompt-card" id="card-${escHtml(p.id)}">
      <div class="prompt-card-header">
        <span class="prompt-title">${escHtml(p.title)}</span>
        ${badge}
      </div>
      <div class="prompt-preview">${preview}</div>
      <div class="prompt-actions">${controls}</div>
    </div>`;
}

function insertPrompt(p: Prompt) {
  chrome.runtime.sendMessage({ type: "INSERT_PROMPT", payload: { content: p.content } }, () => {
    // Close popup after successful insert
    window.close();
  });
}

function deletePrompt(id: string) {
  chrome.runtime.sendMessage({ type: "DELETE_PROMPT", payload: { id } }, () => {
    loadPrompts();
  });
}

// ── Prompt form ───────────────────────────────────────────────────────────────

function openNewPromptForm() {
  editingPromptId = null;
  (document.getElementById("promptFormTitle") as HTMLElement).textContent = t("prompt_form_new");
  (document.getElementById("promptTitleInput") as HTMLInputElement).value = "";
  (document.getElementById("promptContentInput") as HTMLTextAreaElement).value = "";
  document.getElementById("promptForm")!.style.display = "block";
  (document.getElementById("promptTitleInput") as HTMLInputElement).focus();
}

function openEditPromptForm(p: Prompt) {
  editingPromptId = p.id;
  editingPromptCreatedAt = p.createdAt;
  (document.getElementById("promptFormTitle") as HTMLElement).textContent = t("prompt_form_edit");
  (document.getElementById("promptTitleInput") as HTMLInputElement).value = p.title;
  (document.getElementById("promptContentInput") as HTMLTextAreaElement).value = p.content;
  document.getElementById("promptForm")!.style.display = "block";
  (document.getElementById("promptTitleInput") as HTMLInputElement).focus();
}

function closePromptForm() {
  document.getElementById("promptForm")!.style.display = "none";
  editingPromptId = null;
  editingPromptCreatedAt = "";
}

function handleSavePrompt() {
  const title = (document.getElementById("promptTitleInput") as HTMLInputElement).value.trim();
  const content = (
    document.getElementById("promptContentInput") as HTMLTextAreaElement
  ).value.trim();

  if (!title || !content) return;

  const prompt: Prompt = {
    id: editingPromptId ?? `p-${Date.now()}`,
    title,
    content,
    createdAt: editingPromptId ? editingPromptCreatedAt : new Date().toISOString(),
  };

  chrome.runtime.sendMessage({ type: "SAVE_PROMPT", payload: prompt }, () => {
    closePromptForm();
    loadPrompts();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

init();
