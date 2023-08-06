import * as CryptoJS from "crypto-js";
import { MarkdownView, View } from "obsidian";


export function encryptText(source: string, password: string) {
  if (!password) throw "error-password-empty";

  const key = CryptoJS.SHA256(password);
  const iv = CryptoJS.lib.WordArray.random(16); // initialization function
  const hashB64 = CryptoJS.MD5(source).toString(CryptoJS.enc.Base64); // length: 24
  const encrypted = CryptoJS.AES.encrypt(hashB64 + source, key, {iv: iv});
  
	const enText = iv.toString(CryptoJS.enc.Base64) + encrypted.toString();
  return enText;
}

export function decryptText(source: string, password: string): DecryptionResult {
  if (!password) return {status:"failed",text:"error-password-empty"}

  const iv = CryptoJS.enc.Base64.parse(source.substring(0, 24));
  const enText = source.substring(24);

  const key = CryptoJS.SHA256(password);
  const decrypted = CryptoJS.AES.decrypt(enText, key, {iv: iv});

	const deText = decrypted.toString(CryptoJS.enc.Utf8);

  // verify
  const hashB64 = deText.substring(0, 24);
  const message = deText.substring(24);
  const messageHashB64 = CryptoJS.MD5(message).toString(CryptoJS.enc.Base64)
  if (hashB64 !== messageHashB64) return {status:"failed", text:"error-incorrect-password"};
  return {status: "success", text: message};
}

export interface DecryptionResult {
  status: "success" | "failed",
  text: string,
}

export function isMarkdownViewSoureMode(markdownView: MarkdownView) {
  return markdownView.getMode() === "source";
}

export function createInputField(parent: HTMLElement, lableText: string, 
  placeholder: string, inputType: string = "text", 
  autocomplete: "off" | "on" = "off", htmlclass: string = "") {
    const group = parent.createDiv(htmlclass);
    group.createDiv().textContent = lableText; // lable
    const input = group.createEl("input");
    input.type = inputType;
    input.autocomplete = autocomplete;
    input.placeholder = placeholder;
    return input;
}

/*
container: Container of the block element
view: view that contains the container (app.workspace.getMostRecentLeaf().view)
*/
export function determineViewMode(container: HTMLElement, view: View, depth = 0): ViewMode {
  if (view.containerEl.getAttribute("data-type") === "canvas") return "canvas";
  if (depth > 10) return "undetermined";
  if (container.hasClass("markdown-reading-view")) return "reading";
  else if (container.hasClass("markdown-source-view")) return "source";
  else if (container.hasClass("markdown-embed-content")) return "embed";
  const parent = container.parentElement;
  if (!parent) return "undetermined";
  else return determineViewMode(parent, view, depth + 1);
}

export type ViewMode = "source" | "reading" | "embed" | "canvas" | "undetermined";

/*
== canvas ==
block-language-testblock
  markdown-preview-sizer markdown-preview-section
    markdown-preview-view markdown-rendered node-insert-event show-indentation-guide allow-fold-headings allow-fold-lists
      markdown-embed-content node-insert-event
*4      canvas-node-content markdown-embed is-loaded
          canvas-node-container

== source-view == 
block-language-testblock
  cm-preview-code-block cm-embed-block markdown-rendered
    cm-content cm-lineWrapping
      cm-contentContainer
        cm-sizer
          cm-scroller
            cm-editor ͼ1 ͼ2 
*7            markdown-source-view cm-s-obsidian mod-cm6 is-folding is-live-preview is-readable-line-width node-insert-event
                view-content

== reading-view ==
block-language-testblock
  markdown-preview-sizer markdown-preview-section
    markdown-preview-view markdown-rendered node-insert-event is-readable-line-width allow-fold-headings show-indentation-guide allow-fold-lists show-frontmatter
*3    markdown-reading-view
        view-content

== embed-view ==
block-language-testblock
  markdown-preview-sizer markdown-preview-section
    markdown-preview-view markdown-rendered node-insert-event show-indentation-guide allow-fold-headings allow-fold-lists
*3    markdown-embed-content node-insert-event
        internal-embed markdown-embed inline-embed is-loaded
*/