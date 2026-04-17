import { BaseAdapter } from "./base";

export class ChatGPTAdapter extends BaseAdapter {
  id = "chatgpt";

  matches(url: string): boolean {
    try {
      const host = new URL(url).hostname;
      return (
        host === "chatgpt.com" ||
        host.endsWith(".chatgpt.com") ||
        host === "chat.openai.com" ||
        host.endsWith(".chat.openai.com")
      );
    } catch {
      return false;
    }
  }

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("#prompt-textarea") ??
      document.querySelector<HTMLElement>('[id="prompt-textarea"]') ??
      // ChatGPT may use contenteditable="plaintext-only" instead of "true"
      document.querySelector<HTMLElement>(
        'div[contenteditable="true"], div[contenteditable="plaintext-only"]',
      ) ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  findSendButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="Send"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="send"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="Senden"]') ??
      // ChatGPT's send button often wraps an SVG; walk up from known icon shapes
      document.querySelector<HTMLElement>(
        'form button:not([aria-label*="Voice"]):not([aria-label*="voice"]):not([aria-label*="Attach"]):not([aria-label*="attach"])[class*="btn"]',
      ) ??
      document.querySelector<HTMLElement>('form button[type="submit"]') ??
      document.querySelector<HTMLElement>("form button:last-of-type")
    );
  }

  extractText(input: HTMLElement): string {
    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    }
    // ChatGPT uses contenteditable <div> with <p> children
    return input.innerText || input.textContent || "";
  }

  setInputText(text: string): void {
    const input = this.findInputElement();
    if (!input) return;

    if (input instanceof HTMLTextAreaElement) {
      // Use native setter so React picks up the change
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) nativeSetter.call(input, text);
      else input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // contenteditable — execCommand keeps React/framework state in sync
      input.focus();
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, text);
    }
  }
}
