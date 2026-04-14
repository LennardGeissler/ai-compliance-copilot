/**
 * Thin wrapper around chrome.i18n so tests and non-extension contexts don't
 * blow up, and so HTML templates can be hydrated declaratively via
 * `data-i18n*` attributes.
 */

export function t(key: string, substitutions?: string | string[]): string {
  const api = (globalThis as { chrome?: { i18n?: { getMessage?: typeof chrome.i18n.getMessage } } })
    .chrome?.i18n;
  const msg = api?.getMessage?.(key, substitutions);
  return msg || key;
}

/** Replace element textContent based on `data-i18n="key"`. */
export function hydrateI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) (el as HTMLInputElement | HTMLTextAreaElement).placeholder = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (!key) return;
    const value = t(key);
    el.title = value;
    if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", value);
  });
}
