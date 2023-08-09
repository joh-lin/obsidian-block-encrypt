import { Modal, App } from "obsidian";
import { createInputField } from "./utils";
import { strings } from "./constants";

export class RequestPasswordModal extends Modal {
  onSubmit: (newPass: string, newHint: string) => void;

  constructor(app: App, onSubmit: (newPass: string, newHint: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
      const { contentEl } = this;

      contentEl.classList.add("new-password-modal");
      
      const passwdInput = createInputField(contentEl, strings["enter-new-password"], strings["password-placeholder"], "password", "off", "password-input");
      const hintInput = createInputField(contentEl, strings["enter-new-hint"], strings["hint-placeholder"], "text", "on", "hint-input");

      const submitButton = contentEl.createEl("button", "submit-button");
      submitButton.textContent = strings["submit-button"];

      submitButton.addEventListener("click", () => {
        this.onSubmit(passwdInput.value, hintInput.value);
      })
  }

  onClose(): void {
      const { contentEl } = this;
      contentEl.empty();
  }
}