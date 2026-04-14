import { BaseAdapter } from "./base";

export class GeminiAdapter extends BaseAdapter {
  id = "gemini";

  matches(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return host === "gemini.google.com" || host.endsWith(".gemini.google.com");
    } catch {
      return false;
    }
  }

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(".ql-editor") ??
      document.querySelector<HTMLElement>('[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("rich-textarea .textarea") ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  findSendButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('button[aria-label="Send message"]') ??
      document.querySelector<HTMLElement>("button.send-button") ??
      document.querySelector<HTMLElement>('[data-mat-icon-name="send"]')?.closest("button") ??
      null
    );
  }

  extractText(input: HTMLElement): string {
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }
    return input.innerText || input.textContent || "";
  }

  /**
   * Gemini uses Quill (.ql-editor contenteditable).
   * execCommand keeps Quill's delta model in sync via its own MutationObserver.
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
