import { Editor, MarkdownView, Plugin, MarkdownPostProcessorContext, WorkspaceLeaf, View } from 'obsidian';
import { generatorBlockProcessor, markdownGeneratorBlock } from './generatorBlock';
import { ENCRYPT_BLOCK_IDENTIFIER, GENERATOR_BLOCK_IDENTIFIER } from './constants';
import { encryptBlockProcessor } from './mainEncryptBlock';
import { determineViewMode } from './utils';

export default class BlockEncryptPlugin extends Plugin {

	async onload() {

		/* This block is the main encryption block. It features:
		- Login View for entering a password
		- A View/Editor View that allows for editing encrypted content if you
		  are in source mode
		*/
		this.registerMarkdownCodeBlockProcessor(ENCRYPT_BLOCK_IDENTIFIER, encryptBlockProcessor)

		/*
		This block only works in source mode. It allows for the creation of encrypted block.
		Here you specify a password and password hint.
		*/
		this.registerMarkdownCodeBlockProcessor(GENERATOR_BLOCK_IDENTIFIER, generatorBlockProcessor)


		/*
		This command spawns a generator block at cursor position.
		*/
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
