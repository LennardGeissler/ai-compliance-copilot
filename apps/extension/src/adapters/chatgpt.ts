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
      document.querySelector<HTMLElement>('div[contenteditable="true"]') ??
      document.querySelector<HTMLElement>("textarea")
    );
  }

  findSendButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[data-testid="send-button"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="Send"]') ??
      document.querySelector<HTMLElement>('button[aria-label*="send"]') ??
      document.querySelector<HTMLElement>('form button[type="submit"]')
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
