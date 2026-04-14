import { BaseAdapter } from "./base";

export class PerplexityAdapter extends BaseAdapter {
  id = "perplexity";

  matches(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return host === "perplexity.ai" || host.endsWith(".perplexity.ai");
    } catch {
      return false;
    }
  }

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("textarea") ??
      document.querySelector<HTMLElement>('[contenteditable="true"]')
    );
  }

  findSendButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('button[aria-label="Submit"]') ??
      document.querySelector<HTMLElement>('button[aria-label="Send"]') ??
      document.querySelector<HTMLElement>("textarea + button") ??
      document
        .querySelector<HTMLElement>('button svg[data-icon="arrow-right"]')
        ?.closest("button") ??
      null
    );
  }

  extractText(input: HTMLElement): string {
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }
    return input.innerText || input.textContent || "";
  }

  setInputText(text: string): void {
    const input = this.findInputElement();
    if (!input) return;

    if (input instanceof HTMLTextAreaElement) {
      // React native setter trick
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) nativeSetter.call(input, text);
      else input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      input.focus();
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, text);
    }
  }
}
