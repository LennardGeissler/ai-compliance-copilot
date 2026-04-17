import type { AdapterContext, SiteAdapter } from "@ai-compliance/shared-types";

/**
 * Base adapter class with shared utilities for all site adapters.
 *
 * Interception strategy: We listen at the document level in capture phase
 * to reliably intercept before React/SPA frameworks process the event.
 */
export abstract class BaseAdapter implements SiteAdapter {
  abstract id: string;
  protected observer: MutationObserver | null = null;
  protected ctx: AdapterContext | null = null;
  protected installed = false;
  private checking = false;
  private bypassing = false;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;

  abstract matches(url: string): boolean;
  abstract findInputElement(): HTMLElement | null;
  abstract findSendButton(): HTMLElement | null;
  abstract extractText(input: HTMLElement): string;

  /**
   * Replaces the content of the AI-tool's input field with `text`.
   *
   * The default implementation handles both <textarea>/<input> (React-style
   * native setter trick) and generic contenteditable elements (execCommand).
   * Site-specific subclasses may override this for framework quirks
   * (ProseMirror, Quill, etc.).
   */
  setInputText(text: string): void {
    const input = this.findInputElement();
    if (!input) return;

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      // React tracks value via a native setter — bypass the synthetic wrapper.
      const proto =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(input, text);
      } else {
        (input as HTMLTextAreaElement).value = text;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (input.isContentEditable) {
      input.focus();
      // execCommand keeps undo history and notifies framework listeners.
      document.execCommand("selectAll", false, undefined);
      document.execCommand("insertText", false, text);
    }
  }

  // Override in subclasses for more precise send-button identification.
  // Default: checks if the element is or contains the pre-found send button.
  isSendButton(el: HTMLElement): boolean {
    const sendBtn = this.findSendButton();
    return sendBtn !== null && (sendBtn === el || sendBtn.contains(el) || el.contains(sendBtn));
  }

  installHooks(ctx: AdapterContext): void {
    this.ctx = ctx;
    this.installed = true;

    // Global capture-phase listeners — these fire BEFORE React's event system
    this.boundKeyHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundClickHandler = (e: MouseEvent) => this.onClick(e);

    document.addEventListener("keydown", this.boundKeyHandler, { capture: true });
    document.addEventListener("click", this.boundClickHandler, { capture: true });

    console.debug(
      "[AI Compliance Copilot] Hooks installed for adapter=%s input=%o sendBtn=%o",
      this.id,
      this.findInputElement(),
      this.findSendButton(),
    );
  }

  destroy(): void {
    if (this.boundKeyHandler) {
      document.removeEventListener("keydown", this.boundKeyHandler, { capture: true });
    }
    if (this.boundClickHandler) {
      document.removeEventListener("click", this.boundClickHandler, { capture: true });
    }
    this.observer?.disconnect();
    this.observer = null;
    this.installed = false;
    this.ctx = null;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.bypassing || this.checking) return;
    if (e.key !== "Enter" || e.shiftKey) return;

    const input = this.findInputElement();
    if (!input) {
      console.debug("[AI Compliance Copilot] Enter pressed but no input element found");
      return;
    }

    const target = e.target as HTMLElement;
    if (!input.contains(target) && input !== target) {
      console.debug(
        "[AI Compliance Copilot] Enter target not inside input. target=%o input=%o",
        target,
        input,
      );
      return;
    }

    const text = this.extractText(input);
    if (!text.trim()) return;

    console.debug("[AI Compliance Copilot] Intercepted Enter — checking %d chars", text.length);

    e.preventDefault();
    e.stopImmediatePropagation();

    this.runCheck(text, () => {
      // Re-dispatch Enter key
      this.bypassing = true;
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
      this.bypassing = false;
    });
  }

  private onClick(e: MouseEvent): void {
    if (this.bypassing || this.checking) return;

    const clickedBtn = (e.target as HTMLElement).closest("button") as HTMLElement | null;
    if (!clickedBtn) return;

    if (!this.isSendButton(clickedBtn)) return;

    const input = this.findInputElement();
    if (!input) {
      console.debug("[AI Compliance Copilot] Send clicked but no input element found");
      return;
    }

    const text = this.extractText(input);
    if (!text.trim()) return;

    console.debug(
      "[AI Compliance Copilot] Intercepted Send click — checking %d chars",
      text.length,
    );

    e.preventDefault();
    e.stopImmediatePropagation();

    this.runCheck(text, () => {
      // Re-click the send button
      this.bypassing = true;
      clickedBtn.click();
      this.bypassing = false;
    });
  }

  private async runCheck(text: string, onAllow: () => void): Promise<void> {
    if (!this.ctx || this.checking) return;
    this.checking = true;

    try {
      const result = await this.ctx.onBeforeSend(text);

      if (result.allowed) {
        onAllow();
      }
    } catch (err) {
      console.error("[AI Compliance Copilot] Check failed:", err);
      // On error, allow the send to avoid blocking the user
      onAllow();
    } finally {
      this.checking = false;
    }
  }
}
