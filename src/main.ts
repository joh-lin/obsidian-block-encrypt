import { Editor, MarkdownView, Plugin } from 'obsidian';
import { generatorBlockProcessor, markdownGeneratorBlock } from './generatorBlock';
import { ENCRYPT_BLOCK_IDENTIFIER, GENERATOR_BLOCK_IDENTIFIER } from './constants';
import { encryptBlockProcessor } from './mainEncryptBlock';



export default class TestPlugin extends Plugin {

	async onload() {

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






// ================ OLD CODE =====================


/*class MyWidget extends WidgetType {
	text: string;

	constructor(text: string) {
		super();
		this.text = text
	}

	eq(widget: MyWidget): boolean {
			return this.text === widget.text
	}

	toDOM(view: EditorView): HTMLElement {
		let container = document.createElement("div");
		let inp = container.createEl("div");
		inp.textContent = decryptCodeBlock(this.text);
		inp.contentEditable = "true";

    return container;
	}

	ignoreEvent() { return true }
}*/




/*const matcherDeco = new MatchDecorator({
			regexp: /startencrypt[\s\S]*?end/g,
			decoration: match => Decoration.replace({
					widget: new MyWidget(match[0]),
			})
		})

		this.registerEditorExtension(Prec.default(ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;

				constructor(view: EditorView) {
					this.decorations = matcherDeco.createDeco(view);
				}

				update(update: ViewUpdate) {
					if (update.docChanged || update.viewportChanged) {
						this.decorations = matcherDeco.updateDeco(update, this.decorations);
					}
				}

				destroy() {}
			},{
				decorations: instance => instance.decorations
			}
		)))
		
		this.registerEditorExtension(ViewPlugin.define(view => {
			return {
				update(update) {
					const transactions = update.transactions;
					console.log("Transactions:", transactions);
				}
			}
		}))

		this.registerEditorExtension(
			StateField.define<number>({
				create(state) {
					return -1;
					state.field(editorEditorField).dispatch({
						filter: [
							
						]
					})
				},
				update(value, tr) {
					//console.log({previous: value, transaction: tr});
					return value+1;
				}
			})
		)

		function myDecoration(editorView: EditorView) {
			let builder = new RangeSetBuilder<Decoration>();
			return builder.finish()
		}

		this.registerEditorExtension(ViewPlugin.fromClass(class {
			decorations: DecorationSet

			constructor(editorView: EditorView) {
				//console.log({editorView: editorView});
				this.decorations = myDecoration(editorView)
			}

			update(viewUpdate: ViewUpdate) {
				/* dont read dom layout here, use requestMeasure 
				//console.log({viewUpdate: viewUpdate})
			}

			destroy() {

			}
		},{
			decorations: v => v.decorations
		}))

		this.registerEditorExtension(EditorView.baseTheme({
			"div.inline-title": {color: "red"}
		}));*/