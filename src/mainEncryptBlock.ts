import { ENCRYPT_BLOCK_IDENTIFIER, strings } from "./constants";
import { DecryptionResult, ViewMode, createInputField, decryptText, determineViewMode, encryptText, isMarkdownViewSoureMode } from "./utils";
import { MarkdownPostProcessorContext, MarkdownView, Editor, setIcon, View } from "obsidian";
import { EditorView } from "@codemirror/view"

export class MainEncryptBlock {

  password: string;
  passwordHint: string;
  encryptedText: string;

  updateEventRegister: {[docId: string]: RenderInformation} = {};

  constructor(readonly blockID: string) {}

  onLayoutReady(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const recLeaf = app.workspace.getMostRecentLeaf();
    if (!recLeaf) throw "getMostRecentLeaf() failed in mainEncryptBlock.process!";

      
    const renderInfo = {
      source: source,
      container: container,
      ctx: ctx,
      viewMode: determineViewMode(container, recLeaf.view),
      view: recLeaf.view,
    }

    this.renderBlock(renderInfo);

    // register for "updateAllViews()"
    this.updateEventRegister[ctx.docId] = renderInfo
    renderInfo.view.register(() => {
      delete this.updateEventRegister[ctx.docId];
    })
  }


  process(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
    // execute the render code when DOM is fully loaded
    // otherwise parents, markdownView and editor might
    // not be accessible
    if (app.workspace.layoutReady) {
      this.onLayoutReady(source, container, ctx);
    } else {
      app.workspace.onLayoutReady(() => {
        this.onLayoutReady(source, container, ctx);
      })
    }
  }

  renderBlock(info: RenderInformation) {
    info.viewMode = determineViewMode(info.container, info.view);

    if (info.viewMode === "undetermined") {
      new MutationObserver((mutations, observer) => {
        this.renderBlock(info);
        observer.disconnect();
      }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
      return;
    }
    
    // first clear all previous content
    info.container.innerHTML = "";

    info.container.createDiv("debug-tag-corner").textContent = info.viewMode;

    // read block data
    const splitText = info.source.split('\n');
    this.passwordHint = splitText[1]//.slice(6);
    this.encryptedText = splitText[2];

    // lable container
		info.container.classList.add("block-encrypt-container");

    
    // render the actual content
    let decResult: DecryptionResult;
    try {
      decResult = decryptText(this.encryptedText, this.password)
    } catch {
      decResult = {status:"failed", text:"error-incorrect-password"};
    }
    let decryptionSuccessful = decResult.status === "success";
    if (decryptionSuccessful) {
      // DISPLAY DECRYPTED TEXT
      const mainTextArea = info.container.createEl("textarea", "main-text-area");
      mainTextArea.value = decResult.text;
      mainTextArea.disabled = info.viewMode !== "source";

      // this text is used by the resizeObserver to detect font size change
      const invisText = info.container.createDiv("invisible-workaround-text");
      invisText.textContent = "A";

      // resize textarea on input
      // TODO: this is very uggly and a bad way
      function updateHeight() {
        mainTextArea.style.height = "0px";
        mainTextArea.style.height = mainTextArea.scrollHeight + "px";
      }

      mainTextArea.addEventListener("input", (e) => { updateHeight() })
      new ResizeObserver((entries) => {
        updateHeight();
      }).observe(invisText)
      updateHeight()

      // ^^^ bad


      if (info.viewMode === "source") {
        
        const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
        if (!markdownView) {
          new MutationObserver((mutations, observer) => {
            this.renderBlock(info);
            observer.disconnect();
          }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
          return;
        }
        const editor = markdownView.editor;

        // save button
        const saveButton = info.container.createEl("button", "save-button");
        setIcon(saveButton, "save");
        //saveButton.textContent = strings["save-button"];

        saveButton.addEventListener("click", (e) => {
          const newEncryptedText = encryptText(mainTextArea.value ?? "ERROR", this.password)

          const sectionInfo = info.ctx.getSectionInfo(info.container);

          if (sectionInfo) {
            editor.replaceRange(newEncryptedText, 
              {line: sectionInfo.lineStart+3, ch: 0}, 
              {line: sectionInfo.lineStart+3, ch: editor.getLine(sectionInfo.lineStart+3).length})

          }

          saveButton.classList.remove("unsaved-changes");
        })

        mainTextArea.addEventListener("input", (e) => {
          saveButton.classList.add("unsaved-changes");
        })
      }


    } else {

      // LOGIN WINDOW

      const loginContainer = info.container.createDiv("login-container");
      // error display div
      const errorDiv = loginContainer.createDiv("error-text");
      // if decryption result failed: display reason
      errorDiv.textContent = (decResult.text in strings) ? (strings as any)[decResult.text] : decResult.text;
      // password hint div
      loginContainer.createDiv("password-hint").textContent = this.passwordHint;
      // password input div
      const passwordInput = createInputField(loginContainer, strings["enter-password"], strings["password-placeholder"], "password", "off", "password-input");
      //button
      const decryptButton = loginContainer.createEl("button", "decrypt-button");
      decryptButton.textContent = strings["decrypt-button"];

      function onDecryptButton(ref: any) {
        ref.password = passwordInput.value;
        // Cause obsidian to re-render this block
        // unload on MarkdownRenderer unload
        ref.updateAllViews();
      }


      decryptButton.addEventListener("click", (e) => {
        onDecryptButton(this)
      })

      passwordInput.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") onDecryptButton(this);
      })

    }
  }

  updateAllViews() {
    for (let docId in this.updateEventRegister) {
      const renderInfo = this.updateEventRegister[docId];
      // then re-render this block
      this.renderBlock(renderInfo);
    }
  }
}


export interface RenderInformation {
  source: string;
  container: HTMLElement;
  viewMode: ViewMode;
  ctx: MarkdownPostProcessorContext;
  view: View;
  /*editor: Editor;
  markdownView: MarkdownView;*/
}

let encryptBlockRegister: any = {}

export function encryptBlockProcessor(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  // get blockID
  const blockID = source.split('\n')[0];
  // register block if it doesn't exist
  if (!(blockID in encryptBlockRegister)) {
    encryptBlockRegister[blockID] = new MainEncryptBlock(blockID);
  }
  // call .process of registered block
  encryptBlockRegister[blockID].process(...arguments)
}

export function markdownEncryptBlock(passkey: string, passwordHint: string, content: string) : string {
  return `\`\`\`${ENCRYPT_BLOCK_IDENTIFIER}
${Date.now()}
Hint: ${passwordHint}
${encryptText(content, passkey)}
\`\`\``
}