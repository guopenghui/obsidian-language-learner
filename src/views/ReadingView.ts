import { Menu, TextFileView, WorkspaceLeaf, Notice } from 'obsidian'
import { App as VueApp, createApp } from 'vue'

import LanguageLearner from '../plugin'
import ReadingArea from 'ReadingArea.vue'
import store from "./store"
import { t } from "../lang/helper"


export const READING_VIEW_TYPE: string = 'langr-reading'
export const READING_ICON: string = 'highlight-glyph'

export class ReadingView extends TextFileView {
    plugin: LanguageLearner
    data: string
    actionButtons: Record<string, HTMLElement> = {}
    vueapp: VueApp
    firstInit: boolean

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf)
        this.plugin = plugin
        this.firstInit = true
    }

    getIcon() {
        return READING_ICON
    }

    getViewData(): string {
        return this.data
    }

    async setViewData(data: string, clear?: boolean) {
        this.data = data
        store.text = data

        if (this.firstInit) {
            this.vueapp = createApp(ReadingArea)
            this.vueapp.config.globalProperties.plugin = this.plugin
            this.vueapp.config.globalProperties.data = this.data
            this.vueapp.config.globalProperties.view = this
            this.vueapp.mount(this.contentEl)

            this.firstInit = false
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
                    .setTitle(t("Return to Markdown"))
                    .setIcon("document")
                    .onClick(() => {
                        this.backToMarkdown()
                    })
            })
            .addSeparator()
        super.onMoreOptionsMenu(menu)
    }

    backToMarkdown(): void {
        this.plugin.setMarkdownView(this.leaf)
    }

    clear(): void {

    }

    // 新词面板中提交后，刷新阅读页面中单词的状态
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

    initHeaderButtons() {
        this.addAction("book", t("Return to Markdown"), () => {
            this.backToMarkdown()
        })
    }

    async onOpen() {
        addEventListener("obsidian-langr-refresh", this.refresh)
        this.initHeaderButtons()

        // const contentEl = this.contentEl.createEl("div", {
        //     cls: "langr-reading",
        // })

    }

    async onClose() {
        removeEventListener("obsidian-langr-refresh", this.refresh)
        this.vueapp.unmount()
    }

}

