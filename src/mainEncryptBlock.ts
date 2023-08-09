import { ENCRYPT_BLOCK_IDENTIFIER, strings } from "./constants";
import { DecryptionResult, ViewMode, createInputField, decryptText, determineViewMode, encryptText, isMarkdownViewSoureMode } from "./utils";
import { MarkdownPostProcessorContext, MarkdownView, Editor, setIcon, View, Modal, App } from "obsidian";
import { EditorView } from "@codemirror/view"
import { RequestPasswordModal } from "./requestPasswordModal";

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
      mainTextArea.placeholder = strings["new-encrypt-block-placeholder"];

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

      

      // buttons
      const buttonContainer = info.container.createDiv("button-container");

      // lock button 
      const lockButton = buttonContainer.createEl("button", "lock-button");
      setIcon(lockButton, "lock");
      lockButton.title = strings["button-lock"]


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
        const editor = markdownView.editor;

        // change password button 
        const changePasswordButton = buttonContainer.createEl("button", "change-password-button");
        setIcon(changePasswordButton, "key");
        changePasswordButton.title = strings["button-change-password"]

        // save button
        const saveButton = buttonContainer.createEl("button", "save-button");
        setIcon(saveButton, "save");
        saveButton.title = strings["button-save"]

        function saveText(content: string, password: string, hint: string | null = null) {
          const newEncryptedText = encryptText(content, password)

          const sectionInfo = info.ctx.getSectionInfo(info.container);

          // write encrypted text to doc
          if (sectionInfo) {
            editor.replaceRange(newEncryptedText, 
              {line: sectionInfo.lineStart+3, ch: 0}, 
              {line: sectionInfo.lineStart+3, ch: editor.getLine(sectionInfo.lineStart+3).length})

            if (hint) {
              editor.replaceRange(`Hint: ${hint}`, 
                {line: sectionInfo.lineStart+2, ch: 0}, 
                {line: sectionInfo.lineStart+2, ch: editor.getLine(sectionInfo.lineStart+2).length})
            }

          }

          // turn button normal color after save
          saveButton.classList.remove("unsaved-changes");
        }

        // lock button with save
        lockButton.addEventListener("click", (e) => {
          saveText(mainTextArea.value ?? "ERROR", this.password);
          this.password = "";
          this.updateAllViews()
        })

        changePasswordButton.addEventListener("click", () => {
          const reqPassModal = new RequestPasswordModal(app, (newPassword, newHint) => {
            saveText(mainTextArea.value ?? "ERROR", newPassword, newHint);
            this.password = newPassword;
            this.updateAllViews();
            reqPassModal.close();
          });
          reqPassModal.open();
        })


        // encrypt and save text
        saveButton.addEventListener("click", (e) => {
          saveText(mainTextArea.value ?? "ERROR", this.password);
        })

        // turns the save button red when there are unsaved changes
        mainTextArea.addEventListener("input", (e) => {
          saveButton.classList.add("unsaved-changes");
        })
      } else { // Not source mode
        // lock button without save
        lockButton.addEventListener("click", (e) => {
          this.password = "";
          this.updateAllViews()
        })
      }

      


    } else {

      // LOGIN WINDOW

      const loginContainer = info.container.createDiv("login-container");
      const div1 = loginContainer.createDiv("div1");
      const div2 = loginContainer.createDiv("div2");

      // password hint div
      const {input: hintDisplay} = createInputField(div1, strings["hint"], "", "text", "off", "password-hint");
      hintDisplay.disabled = true;
      hintDisplay.value = this.passwordHint.substring(6);
      // password input div
      const {input:passwordInput} = createInputField(div1, strings["enter-password"], strings["password-placeholder"], "password", "off", "password-input");
      
      // error display div
      const errorDiv = div2.createDiv("error-text");
      // if decryption result failed: display reason
      errorDiv.textContent = (decResult.text in strings) ? (strings as any)[decResult.text] : decResult.text;
      //button
      const decryptButton = div2.createEl("button", "decrypt-button");
      //decryptButton.textContent = strings["decrypt-button"];
      setIcon(decryptButton, "key");

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

function getBlockOfBlockID(blockID: string): MainEncryptBlock {
  // register block if it doesn't exist
  if (!(blockID in encryptBlockRegister)) {
    encryptBlockRegister[blockID] = new MainEncryptBlock(blockID);
  }
  return encryptBlockRegister[blockID];
}

/*
This function gives each block of encrypted text an instance of MainEncryptBlock, 
which for example stores the password
*/
export function encryptBlockProcessor(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  // get blockID
  const blockID = source.split('\n')[0];
  // call .process of registered block
  getBlockOfBlockID(blockID).process(source, container, ctx);
}

export function setPasswordForBlockID(blockID: string, password: string) {
  getBlockOfBlockID(blockID).password = password;
}

/*
Provides a template that is inserted into doc by generator block
*/
export function markdownEncryptBlock(passkey: string, passwordHint: string, blockID: string = Date.now().toString(), content: string = "") : string {
  return `\`\`\`${ENCRYPT_BLOCK_IDENTIFIER}
${blockID}
Hint: ${passwordHint}
${encryptText(content, passkey)}
\`\`\``
}