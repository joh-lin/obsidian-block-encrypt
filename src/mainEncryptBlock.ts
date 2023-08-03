import { ENCRYPT_BLOCK_IDENTIFIER, strings } from "./constants";
import { createInputField, decryptText, encryptText, isMarkdownViewSoureMode } from "./utils";
import { MarkdownPostProcessorContext, MarkdownView, Editor, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view"

export class MainEncryptBlock {

  password: string;
  passwordHint: string;
  encryptedText: string;

  updateEventRegister: {[docId: string]: RenderInformation} = {};

  constructor(readonly blockID: string) {}

  process(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
    // if markdownView is not available yet, wait for obsidian to completely load
    // and then execute render code
    if (!markdownView) {
      const ref = app.workspace.on("layout-change", () => {
        this.process(source, container, ctx);
        app.workspace.offref(ref);
      })
      return;
    }
    const editor = markdownView.editor;
    const isSourceMode = isMarkdownViewSoureMode(markdownView);

    // read block data
    const splitText = source.split('\n');
    this.passwordHint = splitText[1]//.slice(6);
    this.encryptedText = splitText[2];

    // lable container
		container.classList.add("jojo-encrypt-container");

    /* 
    IF password correct:
      Show decrypted text
        IF source mode:
          Show Save Button
          Text editable
    ELSE IF password wrong or not entered
      Show login view


    encryptedText, container, isSourceMode, ctx, passwordHint

    editor is in 
    markdownfileinfo, markdownview, markdowneditview, markdownsourceview
    */

    const renderInfo = {
      ctx: ctx,
      container: container,
      editor: editor,
      isSourceMode: isSourceMode,
      markdownView: markdownView,
    }

    this.renderBlock(renderInfo)
    
    this.updateEventRegister[ctx.docId] = renderInfo
    markdownView.register(() => {
      delete this.updateEventRegister[ctx.docId];
    })
  }

  renderBlock(info: RenderInformation) {
    try {
      const decryptedText = decryptText(this.encryptedText, this.password)

      // DISPLAY DECRYPTED TEXT
      const mainTextArea = info.container.createEl("textarea", "main-text-area");
      mainTextArea.value = decryptedText;

      // resize textarea on input
      // TODO: this is very uggly and a bad way
      function updateHeight() {
        mainTextArea.style.height = "0px";
        mainTextArea.style.height = mainTextArea.scrollHeight + "px";
      }

      mainTextArea.addEventListener("input", (e) => { updateHeight() })
      new ResizeObserver((entries) => {
        updateHeight();
      }).observe(info.markdownView.contentEl.getElementsByClassName("cm-sizer")[0])
      updateHeight()

      // ^^^ bad


      if (info.isSourceMode) {
        //mainTextArea.contentEditable = "true";

        // save button
        const saveButton = info.container.createEl("button", "save-button");
        setIcon(saveButton, "save");
        //saveButton.textContent = strings["save-button"];

        saveButton.addEventListener("click", (e) => {
          const newEncryptedText = encryptText(mainTextArea.value ?? "ERROR", this.password)

          const sectionInfo = info.ctx.getSectionInfo(info.container);

          if (sectionInfo) {
            info.editor.replaceRange(newEncryptedText, 
              {line: sectionInfo.lineStart+3, ch: 0}, 
              {line: sectionInfo.lineStart+3, ch: info.editor.getLine(sectionInfo.lineStart+3).length})

          }

          saveButton.classList.remove("unsaved-changes");
        })

        mainTextArea.addEventListener("input", (e) => {
          saveButton.classList.add("unsaved-changes");
        })
      }


    } catch(err) {

      // LOGIN WINDOW

      const loginContainer = info.container.createDiv("login-container");
      // error display div
      const errorDiv = loginContainer.createDiv("error-text");
      errorDiv.textContent = (err in strings) ? (strings as any)[err] : err;
      // password hint div
      loginContainer.createDiv("password-hint").textContent = this.passwordHint;
      // password input div
      const passwordInput = createInputField(loginContainer, strings["enter-password"], strings["password-placeholder"], "password", "off", "password-input");
      //button
      const decryptButton = loginContainer.createEl("button", "decrypt-button");
      decryptButton.textContent = strings["decrypt-button"];


      decryptButton.addEventListener("click", (e) => {
        this.password = passwordInput.value;
        // Cause obsidian to re-render this block
        // unload on MarkdownRenderer unload
        this.updateAllViews();
      })

    }
  }

  updateAllViews() {
    for (let docId in this.updateEventRegister) {
      const renderInfo = this.updateEventRegister[docId];
      // first clear all previous content
      renderInfo.container.innerHTML = "";
      // then re-render this block
      this.renderBlock(renderInfo);
    }
  }
}

interface RenderInformation {
  container: HTMLElement;
  isSourceMode: boolean;
  ctx: MarkdownPostProcessorContext;
  editor: Editor;
  markdownView: MarkdownView;
}

let encryptBlockRegister: any = {}

export function encryptBlockProcessor(source: string, container: HTMLElement, ctx: MarkdownPostProcessorContext) {
  const blockID = source.split('\n')[0];
  if (!(blockID in encryptBlockRegister)) {
    encryptBlockRegister[blockID] = new MainEncryptBlock(blockID);
  }
  encryptBlockRegister[blockID].process(...arguments)
}

export function markdownEncryptBlock(passkey: string, passwordHint: string, content: string) : string {
  return `\`\`\`${ENCRYPT_BLOCK_IDENTIFIER}
${Date.now()}
Hint: ${passwordHint}
${encryptText(content, passkey)}
\`\`\``
}