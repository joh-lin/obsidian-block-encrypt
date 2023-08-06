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

  
  process(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
    /*
    Because the recentleaf function is not always available I wait for layoutReady before
    the block is rendered.
    */

    if (app.workspace.layoutReady) {
      this.onLayoutReady(source, container, ctx);
    } else {
      app.workspace.onLayoutReady(() => {
        this.onLayoutReady(source, container, ctx);
      })
    }
  }

  onLayoutReady(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
    /*
    Recent Leaf allows you to determine the block's view mode
    */
    const recLeaf = app.workspace.getMostRecentLeaf();
    if (!recLeaf) throw "getMostRecentLeaf() failed in mainEncryptBlock.process!";

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

    // actually render the block
    this.renderBlock(renderInfo);

    // register for "updateAllViews()" 
    this.updateEventRegister[ctx.docId] = renderInfo
    // when the view is destroyed also unregister this block from "updateAllViews()"
    renderInfo.view.register(() => {
      delete this.updateEventRegister[ctx.docId];
    })
  }


  renderBlock(info: RenderInformation) {
    // determine view mode
    info.viewMode = determineViewMode(info.container, info.view);

    /*
    If viewMode could not be determined, the window was probably not loaded yet
    so register mutationObserver to try again
    */
   console.log(info.viewMode)
    if (info.viewMode === "undetermined") {
      new MutationObserver((mutations, observer) => {
        this.renderBlock(info);
        observer.disconnect(); // delete observer after trying
      }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
      return;
    }
    
    // first clear all previous content
    info.container.innerHTML = "";

    // tag that shows the view mode
    info.container.createDiv("debug-tag-corner").textContent = info.viewMode;

    // read block data
    const splitText = info.source.split('\n');
    this.passwordHint = splitText[1]//.slice(6);
    this.encryptedText = splitText[2];

    // lable the container
		info.container.classList.add("block-encrypt-container");

    
    // attempt to decrypt the text using provided password
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
      function updateHeight() {
        mainTextArea.style.height = "0px";
        mainTextArea.style.height = mainTextArea.scrollHeight + "px";
      }

      mainTextArea.addEventListener("input", (e) => { updateHeight() })

      new ResizeObserver((entries) => {
        updateHeight();
      }).observe(info.container);

      new ResizeObserver((entries) => {
        updateHeight();
      }).observe(invisText)
      updateHeight()

      // ^^^ bad (maybe)


      if (info.viewMode === "source") {
        /* If block is in source mode the main textarea is editable.
        also in the bottom left corner there is a save button
        */
        
        // try to get markdownView and editor
        const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
        if (!markdownView) {  // if it didn't work try again on DOM mutation
          new MutationObserver((mutations, observer) => {
            this.renderBlock(info);
            observer.disconnect();
          }).observe(info.view.containerEl, {subtree: true, childList: true, attributes: true});
          return;
        }
        console.log("yes markdown")
        const editor = markdownView.editor;

        // save button
        const saveButton = info.container.createEl("button", "save-button");
        setIcon(saveButton, "save");

        // encrypt and save text
        saveButton.addEventListener("click", (e) => {
          const newEncryptedText = encryptText(mainTextArea.value ?? "ERROR", this.password)

          const sectionInfo = info.ctx.getSectionInfo(info.container);

          // write encrypted text to doc
          if (sectionInfo) {
            editor.replaceRange(newEncryptedText, 
              {line: sectionInfo.lineStart+3, ch: 0}, 
              {line: sectionInfo.lineStart+3, ch: editor.getLine(sectionInfo.lineStart+3).length})

          }

          // turn button normal color after save
          saveButton.classList.remove("unsaved-changes");
        })

        // turns the save button red when there are unsaved changes
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

  /*
  This notifies all registered block to re-render their content
  will be triggered on password enter and text change.
  */
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

/*
This function gives each block of encrypted text an instance of MainEncryptBlock, 
which for example stores the password
*/
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

/*
Provides a template that is inserted into doc by generator block
*/
export function markdownEncryptBlock(passkey: string, passwordHint: string, content: string) : string {
  return `\`\`\`${ENCRYPT_BLOCK_IDENTIFIER}
${Date.now()}
Hint: ${passwordHint}
${encryptText(content, passkey)}
\`\`\``
}