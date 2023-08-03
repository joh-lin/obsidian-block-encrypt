import { MarkdownView } from "obsidian";
import { AES, enc } from "crypto-js";

// TODO: make en/decryption more safe

export function encryptText(source: string, password: string) {
  if (!password) throw "error-password-empty";
  const encrypted = AES.encrypt("ACCEPT"+source, password);
	const enText =  encrypted.toString();
  return enText;
}

export function decryptText(source: string, password: string) {
  if (!password) throw "error-password-empty";
  const decrypted = AES.decrypt(source, password);
	const deText = decrypted.toString(enc.Utf8);
  if (!deText.startsWith("ACCEPT")) throw "error-incorrect-password";
  return deText.slice(6);
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