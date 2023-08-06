import { Editor, MarkdownView, Plugin, MarkdownPostProcessorContext, WorkspaceLeaf, View } from 'obsidian';
import { generatorBlockProcessor, markdownGeneratorBlock } from './generatorBlock';
import { ENCRYPT_BLOCK_IDENTIFIER, GENERATOR_BLOCK_IDENTIFIER } from './constants';
import { encryptBlockProcessor } from './mainEncryptBlock';
import { determineViewMode } from './utils';

export let blockEncryptPlugin: BlockEncryptPlugin;

export default class BlockEncryptPlugin extends Plugin {

	async onload() {

		blockEncryptPlugin = this;

		this.registerMarkdownCodeBlockProcessor(ENCRYPT_BLOCK_IDENTIFIER, encryptBlockProcessor)

		this.registerMarkdownCodeBlockProcessor(GENERATOR_BLOCK_IDENTIFIER, generatorBlockProcessor)


		this.addCommand({
			id: "insert-encryption-block",
			name: "Insert encryption block",
			editorCallback: (editor: Editor, ctx: MarkdownView) => {
				editor.replaceRange(markdownGeneratorBlock(), editor.getCursor());
				// set cursor after generator block
				editor.setCursor({line: editor.getCursor().line+3, ch: 0});
			}
		})

	}

	onunload() {
		
	}


}
