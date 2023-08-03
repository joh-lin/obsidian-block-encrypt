import { MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import { GENERATOR_BLOCK_IDENTIFIER, strings } from "./constants";
import { isMarkdownViewSoureMode, createInputField } from "./utils";
import { markdownEncryptBlock } from "./mainEncryptBlock";

export function generatorBlockProcessor(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
  // if markdownView is not available yet, wait for obsidian to completely load
  // and then execute render code
  if (!markdownView) {
    const ref = app.workspace.on("layout-change", () => {
      generatorBlockProcessor(source, container, ctx);
      app.workspace.offref(ref);
    })
    return;
  }
  const editor = markdownView.editor;
  const isSourceMode = isMarkdownViewSoureMode(markdownView);

  
  // lable container
  container.classList.add("jojo-generator-container");

  // IN SOURCE MODE
  if (isSourceMode) {
    const passwordInput1 = createInputField(container, strings["enter-password"], strings["password-placeholder"], "password", "off", "password-input");
    const passwordInput2 = createInputField(container, strings["repeat-password"], strings["password-placeholder"], "password", "off", "password-input");
    const hintInput = createInputField(container, strings["enter-password-hint"], strings["hint-placeholder"], "text", "on", "hint-input");
    const errorDiv = container.createDiv("error-text");
    const generateButton = container.createEl("button", "generate-button");
    generateButton.textContent = strings["generate-button"];

    // Generate Button
    generateButton.addEventListener("click", (e) => {
      if (passwordInput1.value !== passwordInput2.value) {
        errorDiv.textContent = strings["passwords-not-matching"]; }

      else if (passwordInput1.value === "" || passwordInput2.value === "") {
        errorDiv.textContent = strings["please-enter-passwords"];}

      else {
        const sectionInfo = ctx.getSectionInfo(container);
        if (sectionInfo) {
          editor.replaceRange(
            markdownEncryptBlock(passwordInput1.value, hintInput.value, strings["new-encrypt-block-placeholder"]),
            {line: sectionInfo.lineStart, ch: 0},
            {line: sectionInfo.lineEnd, ch: editor.getLine(sectionInfo.lineEnd).length}
          );
        }
      }
    });
  } 

  // IN READ MODE
  else {
    container.createEl("div", "read-mode-title").textContent = strings["generator-in-read-mode-title"];
    container.createDiv("read-mode-div").textContent = strings["generator-in-read-mode-div"];
  }
}

export function markdownGeneratorBlock(): string {
  return `\n\`\`\`${GENERATOR_BLOCK_IDENTIFIER}\n\`\`\`\n`;
}