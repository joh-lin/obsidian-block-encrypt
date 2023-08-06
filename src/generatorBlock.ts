import { MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import { GENERATOR_BLOCK_IDENTIFIER, strings } from "./constants";
import { isMarkdownViewSoureMode, createInputField, determineViewMode } from "./utils";
import { RenderInformation, markdownEncryptBlock } from "./mainEncryptBlock";

export function generatorBlockProcessor(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  /*
  Because the recentleaf function is not always available I wait for layoutReady before
  the block is rendered.
  */
  if (app.workspace.layoutReady) {
    onLayoutReady(source, container, ctx);
  } else {
    app.workspace.onLayoutReady(() => {
      onLayoutReady(source, container, ctx);
    })
  }
}

function onLayoutReady(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  /*
  Recent Leaf allows you to determine the block's view mode
  */
  const recLeaf = app.workspace.getMostRecentLeaf();
  if (!recLeaf) throw "getMostRecentLeaf() failed in generatorBlock.process!";

  /*
  Stores information about the block for easy storage + access
  */
  const renderInfo = {
    source: source,
    container: container,
    ctx: ctx,
    viewMode: determineViewMode(container, recLeaf.view),
    view: recLeaf.view,
  }

  // render
  renderBlock(renderInfo);
}

function renderBlock(info: RenderInformation) {
  // determine view mode
  info.viewMode = determineViewMode(info.container, info.view);

  /*
  If viewMode could not be determined, the window was probably not loaded yet
  so register mutationObserver to try again
  */
  if (info.viewMode === "undetermined") {
    new MutationObserver((mutations, observer) => {
      renderBlock(info);
      observer.disconnect();
    }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
    return;
  }
    
  // first clear all previous content
  info.container.innerHTML = "";

  // tag that shows the view mode
  info.container.createDiv("debug-tag-corner").textContent = info.viewMode;
  
  // lable container
  info.container.classList.add("block-generator-container");

  // IN SOURCE MODE
  if (info.viewMode === "source") {
    /*
    Only allow user to generate if in source mode
    */
    
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
    if (!markdownView) {
      new MutationObserver((mutations, observer) => {
        renderBlock(info);
        observer.disconnect();
      }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
      return;
    }
    const editor = markdownView.editor;

    // create html elements
    const passwordInput1 = createInputField(info.container, strings["enter-password"], strings["password-placeholder"], "password", "off", "password-input");
    const passwordInput2 = createInputField(info.container, strings["repeat-password"], strings["password-placeholder"], "password", "off", "password-input");
    const hintInput = createInputField(info.container, strings["enter-password-hint"], strings["hint-placeholder"], "text", "on", "hint-input");
    const errorDiv = info.container.createDiv("error-text");
    const generateButton = info.container.createEl("button", "generate-button");
    generateButton.textContent = strings["generate-button"];

    // Generate Button
    generateButton.addEventListener("click", (e) => {
      if (passwordInput1.value !== passwordInput2.value) {
        errorDiv.textContent = strings["passwords-not-matching"]; }

      else if (passwordInput1.value === "" || passwordInput2.value === "") {
        errorDiv.textContent = strings["please-enter-passwords"];}

      else {
        const sectionInfo = info.ctx.getSectionInfo(info.container);
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
    info.container.createEl("div", "read-mode-title").textContent = strings["generator-in-read-mode-title"];
    info.container.createDiv("read-mode-div").textContent = strings["generator-in-read-mode-div"];
  }
}

/*
Template inserted into doc by command
*/
export function markdownGeneratorBlock(): string {
  return `\n\`\`\`${GENERATOR_BLOCK_IDENTIFIER}\n\`\`\`\n`;
}