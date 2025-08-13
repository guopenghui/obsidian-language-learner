import { Menu, TextFileView, WorkspaceLeaf, Notice } from 'obsidian';
import { App as VueApp, createApp } from 'vue';

import LanguageLearner from '@/plugin';
import ReadingArea from 'ReadingArea.vue';
import { t } from "@/lang/helper";


export const READING_VIEW_TYPE: string = 'langr-reading';
export const READING_ICON: string = 'highlight-glyph';

export class ReadingView extends TextFileView {
    plugin: LanguageLearner;
    text: string;
    actionButtons: Record<string, HTMLElement> = {};
    vueapp: VueApp;
    firstInit: boolean;
    lastPos: number;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
        this.firstInit = true;
    }

    getIcon() {
        return READING_ICON;
    }

    getViewData(): string {
        return this.data;
    }

    async setViewData(data: string, clear?: boolean) {
        this.text = data;
        // console.log("this.text", this.text);
        
        if (this.firstInit) {
            let lastPos = await this.plugin.frontManager.getFrontMatter(this.file, "langr-pos");
            this.lastPos = parseInt(lastPos);

            this.vueapp = createApp(ReadingArea);
            this.vueapp.config.globalProperties.plugin = this.plugin;
            this.vueapp.config.globalProperties.view = this;
            this.vueapp.mount(this.contentEl);

            this.firstInit = false;
        }
        //this.plugin.setMarkdownView(this.leaf, false)
    }

    getViewType(): string {
        return READING_VIEW_TYPE;
    }


    onPaneMenu(menu: Menu): void {
        menu
            .addItem((item) => {
                item
                    .setTitle(t("Return to Markdown"))
                    .setIcon("document")
                    .onClick(() => {
                        this.backToMarkdown();
                    });
            })
            .addSeparator();
        super.onPaneMenu(menu, "");
    }

    backToMarkdown(): void {
        this.plugin.setMarkdownView(this.leaf);
    }

    async saveWords() {
        if ((await this.readContent("words")) === null) {
            return;
        }

        let data = await this.readContent("article");
        let exprs = (await this.plugin.parser.getWordsPhrases(data))
            .map(w => `+ **${w.expression}** : ${w.meaning}`)
            .join("\n") + "\n\n";

        await this.writeContent("words", exprs);
    }

    divide(lines: string[]) {
        let positions = [] as [string, number][];
        positions.push(["article", lines.indexOf("^^^article")],
            ["words", lines.indexOf("^^^words")],
            ["notes", lines.indexOf("^^^notes")]);
        positions.sort((a, b) => a[1] - b[1]);
        positions = positions.filter((v) => v[1] !== -1);
        positions.push(["eof", lines.length]);

        let segments = {} as { [K in string]: { start: number, end: number; } };
        for (let i = 0; i < positions.length - 1; i++) {
            segments[`${positions[i][0]}`] = { start: positions[i][1] + 1, end: positions[i + 1][1] };
        }
        return segments;
    }

    async readContent(type: string, create: boolean = false): Promise<string> {
        let oldText = await this.plugin.app.vault.read(this.file);
        let lines = oldText.split("\n");
        let seg = this.divide(lines);
        if (!seg[type]) {
            if (create) {
                this.plugin.app.vault.modify(this.file, oldText + `\n^^^${type}\n\n`);
                return "";
            }
            return null;
        }
        return lines.slice(seg[type].start, seg[type].end).join("\n");
    }

    async writeContent(type: string, content: string): Promise<void> {
        let oldText = await this.plugin.app.vault.read(this.file);
        let lines = oldText.split("\n");
        let seg = this.divide(lines);
        if (!seg[type]) {
            return;
        }
        let newText = lines.slice(0, seg[type].start).join("\n") +
            "\n" + content.trim() + "\n\n" +
            lines.slice(seg[type].end, lines.length).join("\n");
        this.plugin.app.vault.modify(this.file, newText);
    }

    clear(): void {

    }

    // 新词面板中提交后，刷新阅读页面中单词的状态
    refresh = (evt?: CustomEvent) => {
        let expression: string = evt.detail.expression.toLowerCase();
        let type: string = evt.detail.type;
        let status: number = evt.detail.status;
        const statusMap = ["ignore", "learning", "familiar", "known", "learned"];

        if (type === "WORD") {
            let wordEls = this.contentEl.querySelectorAll(".word");
            if (wordEls.length === 0) {
                return;
            }
            wordEls.forEach((el) => {
                if (el.textContent.toLowerCase() === expression) {
                    el.className = `word ${statusMap[status]}`;
                }
            });
        } else if (type === "PHRASE") {
            let phraseEls = this.contentEl.querySelectorAll(".phrase");
            let isExist = false;
            if (phraseEls.length > 0) {
                phraseEls.forEach((el) => {
                    if (el.textContent.toLowerCase() === expression) {
                        isExist = true;
                        el.className = `phrase ${statusMap[status]}`;
                    }
                });
            }

            this.removeSelect();
            if (isExist) {
                return;
            }

            // 词组拆分成单词和空格
            let words: string[] = [];
            expression.split(" ").forEach((w) => {
                if (w !== "") {
                    words.push(w, " ");
                }
            });
            words.pop();


            let isMatch = (startEl: Element, words: string[]) => {
                let el = startEl as any;
                let container: Element[] = [];
                for (let word of words) {
                    if (!el || el.textContent.toLowerCase() !== word) {
                        return null;
                    }
                    container.push(el);
                    el = el.nextSibling;
                }

                return container;
            };

            // 在匹配词组的单词元素外面包一个span.phrase
            let sentencesEls = this.containerEl.querySelectorAll(".stns");
            sentencesEls.forEach((senEl) => {
                let children = senEl.children;
                let idx = -1;
                while (idx++ < children.length) {
                    let container;
                    if (container = isMatch(children[idx], words)) {

                        let phraseEl = createSpan({ cls: `phrase ${statusMap[status]}` });
                        senEl.insertBefore(phraseEl, children[idx]);
                        container.forEach((el) => {
                            el.remove();
                            phraseEl.appendChild(el);
                        });
                        idx += words.length - 1;
                    }
                }
            });
        }
    };

    wrapSelect(elStart: HTMLElement, elEnd: HTMLElement) {
        this.removeSelect();
        if (!elStart.matchParent(".stns") ||
            !elEnd.matchParent(".stns") ||
            elStart.parentElement !== elEnd.parentElement) {
            return null;
        }
        let parent = elStart.parentNode;
        let selectSpan = document.body.createSpan({ cls: "select" });
        parent.insertBefore(selectSpan, elStart);
        for (let el: Node = elStart; el !== elEnd;) {
            let next = el.nextSibling;
            selectSpan.appendChild(el);
            el = next;
        }
        selectSpan.appendChild(elEnd);
        return selectSpan;
    }

    removeSelect() {
        //把span.select里面的东西拿出来
        let selects = this.contentEl.querySelectorAll("span.select");
        selects.forEach((el: HTMLElement) => {
            let parent = el.parentElement;
            let children: Node[] = [];
            el.childNodes.forEach((child) => {
                children.push(child);
            });
            for (let c of children) {
                parent.insertBefore(c, el);
            }
            el.remove();
        });
    }

    initHeaderButtons() {
        this.addAction("book", t("Return to Markdown"), () => {
            this.backToMarkdown();
        });
    }

    async onOpen() {
        addEventListener("obsidian-langr-refresh", this.refresh);
        this.initHeaderButtons();

        // const contentEl = this.contentEl.createEl("div", {
        //     cls: "langr-reading",
        // })

    }

    async onClose() {
        removeEventListener("obsidian-langr-refresh", this.refresh);
        this.vueapp.unmount();
        this.saveWords();
    }

}

