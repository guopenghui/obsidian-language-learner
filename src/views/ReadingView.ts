import { Menu, TextFileView, WorkspaceLeaf, Notice } from 'obsidian'
import LanguageLearner from '../plugin'
// import parse from './parser'
import { t } from "../lang/helper"


export const READING_VIEW_TYPE: string = 'langr-reading'
export const READING_ICON: string = 'highlight-glyph'

export class ReadingView extends TextFileView {
    plugin: LanguageLearner
    data: string

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf)
        this.plugin = plugin
    }

    getIcon() {
        return READING_ICON
    }

    getViewData(): string {
        return this.data
    }

    async setViewData(data: string, clear?: boolean) {
        this.data = data

        data = await this.plugin.parser.parse(data)

        let frontMatter = this.plugin.app.metadataCache.getFileCache(this.file).frontmatter
        let audio = ""
        if (frontMatter["langr-audio"]) {
            audio = "<audio controls "
                + `src="${frontMatter["langr-audio"]}">`
                + "Your browser does not support the <code>audio</code> element."
                + "</audio>"
        }
        let finishButton = `<button class="finish-reading">`
            + `${t("Finish Reading")}`
            + `</button>`

        let functional = `<div `
            + `class="func-area"`
            + `style="padding-bottom:20px;`
            + `border-bottom:2px solid gray;"`
            + `>`
            + `${audio}${finishButton}`
            + `</div>`

        let text_area = `<div `
            + `class="text-area"`
            + `style="overflow:auto;`
            + `flex:1;padding-top:20px;`
            + `padding-left:5%;`
            + `padding-right:5%;"`
            + `>`
            + `${data}`
            + `</div>`

        let layout = `<div id="langr-reading"`
            + `style="height:100%;`
            + `width:100%;overflow:hidden;`
            + `display:flex;flex-direction:column;"`
            + `>`
            + `${functional}`
            + `${text_area}`
            + `</div>`

        this.contentEl.innerHTML = layout

        let button = this.contentEl.querySelector(".finish-reading")
        if (button) {
            button.addEventListener("click", async () => {
                let ignores = this.containerEl.querySelectorAll(".word.new")
                let ignore_words: string[] = []
                ignores.forEach((el) => {
                    ignore_words.push(el.textContent.toLowerCase())
                })

                await this.plugin.db.postIgnoreWords(ignore_words)
                this.setViewData(this.data)
                dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"))
            })
        }
        //this.plugin.setMarkdownView(this.leaf, false)
    }

    getViewType(): string {
        return READING_VIEW_TYPE
    }


    onMoreOptionsMenu(menu: Menu): void {
        menu
            .addItem((item) => {
                item
                    .setTitle(t("Return Markdown View"))
                    .setIcon("document")
                    .onClick(() => {
                        this.plugin.setMarkdownView(this.leaf)
                    })
            })
            .addSeparator()
        super.onMoreOptionsMenu(menu)
    }

    clear(): void {

    }

    refresh = (evt?: CustomEvent) => {
        let expression: string = evt.detail.expression.toLowerCase()
        let type: string = evt.detail.type
        let status: number = evt.detail.status
        const statusMap = ["ignore", "learning", "familiar", "known", "learned"];

        if (type === "WORD") {
            let wordEls = this.contentEl.querySelectorAll(".word");
            if (wordEls.length === 0) {
                return
            }
            wordEls.forEach((el) => {
                if (el.textContent.toLowerCase() === expression) {
                    el.className = `word ${statusMap[status]}`
                }
            })
        } else if (type === "PHRASE") {
            let phraseEls = this.contentEl.querySelectorAll(".phrase");
            let isExist = false;
            if (phraseEls.length > 0) {
                phraseEls.forEach((el) => {
                    if (el.textContent.toLowerCase() === expression) {
                        isExist = true;
                        el.className = `phrase ${statusMap[status]}`
                    }
                })
            }

            this.removeSelect()
            if (isExist) {
                return
            }

            // 词组拆分成单词和空格
            let words: string[] = [];
            expression.split(" ").forEach((w) => {
                if (w !== "") {
                    words.push(w, " ")
                }
            })
            words.pop()


            let isMatch = (startEl: Element, words: string[]) => {
                let el = startEl as any
                let container: Element[] = []
                for (let word of words) {
                    if (!el || el.textContent.toLowerCase() !== word) {
                        return null
                    }
                    container.push(el)
                    el = el.nextSibling
                }

                return container
            }

            // 在匹配词组的单词元素外面包一个span.phrase
            let sentencesEls = this.containerEl.querySelectorAll(".stns");
            sentencesEls.forEach((senEl) => {
                let children = senEl.children
                let idx = -1
                while (idx++ < children.length) {
                    let container;
                    if (container = isMatch(children[idx], words)) {

                        let phraseEl = createSpan({ cls: `phrase ${statusMap[status]}` })
                        senEl.insertBefore(phraseEl, children[idx])
                        container.forEach((el) => {
                            el.remove()
                            phraseEl.appendChild(el)
                        })
                        idx += words.length - 1
                    }
                }
            })
        }
    }

    removeSelect() {
        //把span.select里面的东西拿出来
        let selects = this.contentEl.querySelectorAll("span.select")
        selects.forEach((el: HTMLElement) => {
            let parent = el.parentElement
            let children: Node[] = []
            el.childNodes.forEach((child) => {
                children.push(child)
            })
            for (let c of children) {
                parent.insertBefore(c, el)
            }
            el.remove()
        })
    }

    async onOpen() {
        addEventListener("obsidian-langr-refresh", this.refresh)
    }

    async onClose() {
        removeEventListener("obsidian-langr-refresh", this.refresh)
    }

}

