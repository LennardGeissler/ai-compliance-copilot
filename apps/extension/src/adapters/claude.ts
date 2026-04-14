import { BaseAdapter } from "./base";

export class ClaudeAdapter extends BaseAdapter {
  id = "claude";

  matches(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return host === "claude.ai" || host.endsWith(".claude.ai");
    } catch {
      return false;
    }
  }

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(".ProseMirror[contenteditable='true']") ??
      document.querySelector<HTMLElement>(".ProseMirror") ??
      document.querySelector<HTMLElement>('[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  findSendButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('button[aria-label="Send Message"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send message"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="Send"]') ??
      document.querySelector<HTMLElement>('fieldset button[type="button"]:last-of-type') ??
      document.querySelector<HTMLElement>('form button[type="submit"]') ??
      document.querySelector<HTMLElement>('[data-testid="send-button"]')
    );
  }

  isSendButton(el: HTMLElement): boolean {
    const label = el.getAttribute("aria-label") ?? "";
    if (/send/i.test(label)) return true;
    if (el.matches('[data-testid="send-button"]')) return true;
    // Claude's send button sits at the bottom-right of the composer fieldset
    const inFieldset = el.closest("fieldset") !== null;
    const isLastBtn = el.matches("fieldset button[type='button']:last-of-type");
    if (inFieldset && isLastBtn) return true;
    return false;
  }

  extractText(input: HTMLElement): string {
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }
    return input.innerText || input.textContent || "";
  }

  /**
   * Claude uses ProseMirror — a contenteditable div managed by a complex
   * internal model.  execCommand("insertText") is the most reliable way to
   * update the visible content and keep ProseMirror's internal state correct.
   */
  setInputText(text: string): void {
    const input = this.findInputElement();
    if (!input) return;

    if (input instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) nativeSetter.call(input, text);
      else input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      input.focus();
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, text);
    }
  }
}
