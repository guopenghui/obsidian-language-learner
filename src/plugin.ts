import {
    App,
    Notice,
    Plugin,
    Menu,
    WorkspaceLeaf,
    ViewState,
    MarkdownView,
    Editor,
    TFile,
    moment,
} from "obsidian";
import { around } from "monkey-around";

import { SearchPanelView, SEARCH_PANEL_VIEW } from "./views/SearchPanelView";
import {
    READING_VIEW_TYPE,
    READING_ICON,
    ReadingView,
} from "./views/ReadingView";
import { LearnPanelView, LEARN_PANEL_VIEW } from "./views/LearnPanelView";
import { StatView, STAT_VIEW_TYPE } from "./views/StatView";

import { t } from "./lang/helper";
import DbProvider from "./db/base"
import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db"
import { TextParser } from "./views/parser"
import { FrontMatterManager } from "./utils/frontmatter"
import Server from "./api/server"

import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab } from "./settings";
import store from "./views/store"
import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";
import { playAudio } from "./utils/helpers";

export const FRONT_MATTER_KEY: string = "langr";


export default class LanguageLearner extends Plugin {
    settings: MyPluginSettings;
    appEl: HTMLElement;
    db: DbProvider;
    server: Server;
    parser: TextParser;
    markdownButtons: Record<string, HTMLElement> = {}
    frontManager: FrontMatterManager;
    store: typeof store = store

    async onload() {
        // 读取设置
        await this.loadSettings();
        this.addSettingTab(new SettingTab(this.app, this));

        // 打开数据库
        this.db = this.settings.use_server ?
            new WebDb(this.settings.port) :
            new LocalDb(this)
        await this.db.open()

        // 设置解析器
        this.parser = new TextParser(this)
        this.frontManager = new FrontMatterManager(this.app)

        // 打开内置服务器
        this.server = this.settings.self_server ?
            new Server(this, this.settings.self_port) :
            null
        await this.server?.start()

        // test
        // this.addCommand({
        // 	id: "langr-test",
        // 	name: "Test for langr",
        // 	callback: () => new Notice("hello!")
        // })

        await this.replacePDF()

        this.storeSettings()

        this.addCommands()
        this.registerCustomViews()
        this.registerReadingToggle()
        this.registerContextMenu();
        this.registerLeftClick();
        this.registerMouseup();
        this.registerEvent(this.app.workspace.on("css-change", () => {
            store.dark = document.body.hasClass("theme-dark");
            store.themeChange = !store.themeChange
        }))
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW);
        this.db.close()
        this.server?.close()
        if (await app.vault.adapter.exists(".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html")) {
            this.registerExtensions([PDF_FILE_EXTENSION], "pdf")
        }
    }

    async replacePDF() {
        if (await app.vault.adapter.exists(".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html")) {
            this.registerView(VIEW_TYPE_PDF, (leaf) => {
                return new PDFView(leaf);
            });

            (this.app as any).viewRegistry.unregisterExtensions([PDF_FILE_EXTENSION])
            this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

            this.registerDomEvent(window, "message", (ev) => {
                if (ev.data.type === "search") {
                    this.queryWord(ev.data.selection)
                }
            })
        }

    }

    storeSettings() {
        this.store.dark = document.body.hasClass("theme-dark")
        this.store.themeChange = false
        this.store.fontSize = this.settings.font_size
        this.store.fontFamily = this.settings.font_family
        this.store.lineHeight = this.settings.line_height
    }

    addCommands() {
        // 注册刷新单词数据库命令
        this.addCommand({
            id: "langr-refresh-word-database",
            name: t("Refresh Word Database"),
            callback: this.refreshWordDb
        });

        // 注册刷新复习数据库命令
        this.addCommand({
            id: "langr-refresh-review-database",
            name: t("Refresh Review Database"),
            callback: this.refreshReviewDb
        })

        // 注册查词命令
        this.addCommand({
            id: "langr-search-word",
            name: t("Translate"),
            callback: () => {
                let selection = window.getSelection().toString().trim()
                this.queryWord(selection)
            }
        })
    }

    registerCustomViews() {
        // 注册查词面板视图
        this.registerView(
            SEARCH_PANEL_VIEW,
            (leaf) => new SearchPanelView(leaf, this)
        );
        this.addRibbonIcon(
            "book",
            t("Open word search panel"),
            (evt) => {
                this.activateView(SEARCH_PANEL_VIEW, "left");
            }
        );

        // 注册新词面板视图
        this.registerView(
            LEARN_PANEL_VIEW,
            (leaf) => new LearnPanelView(leaf, this)
        );
        this.addRibbonIcon(
            "reading-glasses",
            t("Open new word panel"),
            (evt) => {
                this.activateView(LEARN_PANEL_VIEW);
            }
        );

        // 注册阅读视图
        this.registerView(
            READING_VIEW_TYPE,
            (leaf) => new ReadingView(leaf, this)
        );

        //注册统计视图
        this.registerView(STAT_VIEW_TYPE, (leaf) => new StatView(leaf, this));
        this.addRibbonIcon("bar-chart-4", t("Open statistics"), async (evt) => {
            this.activateView(STAT_VIEW_TYPE);
        });
    }

    async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
        await leaf.setViewState(
            {
                type: "markdown",
                state: leaf.view.getState(),
                //popstate: true,
            } as ViewState,
            { focus }
        );
    }

    async setReadingView(leaf: WorkspaceLeaf) {
        await leaf.setViewState({
            type: READING_VIEW_TYPE,
            state: leaf.view.getState(),
            //popstate: true,
        } as ViewState);
    }

    async refreshTextDB() {
        await this.refreshWordDb();
        await this.refreshReviewDb();
        (this.app as any).commands.executeCommandById("various-complements:reload-custom-dictionaries")
    }

    refreshWordDb = async () => {
        if (!this.settings.word_database) {
            return
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        )
        if (!dataBase || dataBase.hasOwnProperty("children")) {
            new Notice("Invalid refresh database path");
            return;
        }
        // 获取所有非无视单词的简略信息
        let words = await this.db.getAllExpressionSimple(false);

        let classified: number[][] = Array(5)
            .fill(0)
            .map((_) => []);
        words.forEach((word, i) => {
            classified[word.status].push(i);
        });

        const statusMap = [
            t("Ignore"),
            t("Learning"),
            t("Familiar"),
            t("Known"),
            t("Learned"),
        ];

        let del = this.settings.col_delimiter

        // 正向查询
        let classified_texts = classified.map((w, idx) => {
            return (
                `#### ${statusMap[idx]}\n` +
                w.map((i) => `${words[i].expression}${del}    ${words[i].meaning}`).join("\n") +
                "\n"
            );
        });
        classified_texts.shift();
        let word2Meaning = classified_texts.join("\n");

        // 反向查询
        let meaning2Word = classified
            .flat()
            .map(
                (i) => `${words[i].meaning}  ${del}  ${words[i].expression}`
            )
            .join("\n");

        let text =
            word2Meaning + "\n\n" + "#### 反向查询\n" + meaning2Word;
        let db = dataBase as TFile;
        this.app.vault.modify(db, text);
    }

    refreshReviewDb = async () => {
        if (!this.settings.review_database) {
            return
        }

        let dataBase = this.app.vault.getAbstractFileByPath(this.settings.review_database)
        if (!dataBase || "children" in dataBase) {
            new Notice("Invalid word database path")
            return
        }

        let db = dataBase as TFile
        let text = await this.app.vault.read(db)
        let oldRecord = {} as { [K in string]: string }
        text.match(/#word(\n.+)+\n(<!--SR.*?-->)/g)
            ?.map(v => v.match(/#### (.+)[\s\S]+(<!--SR.*-->)/))
            ?.forEach(v => {
                oldRecord[v[1]] = v[2]
            })

        // let data = await this.db.getExpressionAfter(this.settings.last_sync)
        let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z")
        if (data.length === 0) {
            // new Notice("Nothing new")
            return
        }

        data.sort((a, b) => a.expression.localeCompare(b.expression))

        let newText = data.map(word => {
            let notes = word.notes.length === 0 ?
                "" :
                "**Notes**:\n" + word.notes.join("\n").trim() + "\n";
            let sentences = word.sentences.length === 0 ?
                "" :
                "**Sentences**:\n" + word.sentences.map(sen => {
                    return (`*${sen.text.trim()}*` + "\n") +
                        (sen.trans ? sen.trans.trim() + "\n" : "") +
                        (sen.origin ? sen.origin.trim() : "")
                }).join("\n").trim() + "\n"

            return `#word\n` +
                `#### ${word.expression}\n` +
                "?\n" +
                `${word.meaning}\n` +
                `${notes}` +
                `${sentences}` +
                (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "")
        }).join("\n") + "\n"

        newText = "#flashcards\n\n" + newText
        await this.app.vault.modify(db, newText)

        this.saveSettings()
    }

    // 在MardownView的扩展菜单加一个转为Reading模式的选项
    registerReadingToggle = () => {
        const pluginSelf = this
        pluginSelf.register(
            around(MarkdownView.prototype, {
                onPaneMenu(next) {
                    return function (m: Menu) {
                        const file = this.file;
                        const cache = file.cache
                            ? pluginSelf.app.metadataCache.getFileCache(file)
                            : null;

                        if (
                            !file ||
                            !cache?.frontmatter ||
                            !cache?.frontmatter[FRONT_MATTER_KEY]
                        ) {
                            return next.call(this, m);
                        }

                        m.addItem((item) => {
                            item.setTitle(t("Open as Reading View"))
                                .setIcon(READING_ICON)
                                .onClick(() => {
                                    pluginSelf.setReadingView(this.leaf);
                                });
                        });

                        next.call(this, m);
                    };
                },

            })
        )

        // 增加标题栏切换阅读模式和mardown模式的按钮
        pluginSelf.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(next) {
                    return function (state: ViewState, ...rest: any[]): Promise<void> {
                        return (next.apply(this, [state, ...rest]) as Promise<void>).then(() => {
                            if (state.type === "markdown" &&
                                state.state?.file
                            ) {
                                const cache = pluginSelf.app.metadataCache.getCache(state.state.file)
                                if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
                                    if (!pluginSelf.markdownButtons["reading"]) {
                                        pluginSelf.markdownButtons["reading"] =
                                            (this.view as MarkdownView).addAction("view", t("Open as Reading View"), () => {
                                                pluginSelf.setReadingView(this)
                                            })
                                        pluginSelf.markdownButtons["reading"].addClass("change-to-reading")
                                    }
                                } else {
                                    pluginSelf.markdownButtons["reading"]?.remove()
                                    pluginSelf.markdownButtons["reading"] = null
                                }
                            } else {
                                pluginSelf.markdownButtons["reading"] = null
                            }
                        })
                    }
                },
            })
        )
    }

    async queryWord(word: string, target?: HTMLElement): Promise<void> {
        await this.activateView(SEARCH_PANEL_VIEW, "left");
        const view = this.app.workspace.getLeavesOfType(
            SEARCH_PANEL_VIEW
        )[0].view as SearchPanelView;
        view.query(word, target);
    }

    // 管理所有的右键菜单
    registerContextMenu() {
        let addMemu = (mu: Menu, selection: string) => {
            mu.addItem((item) => {
                item.setTitle(t("Search word"))
                    .setIcon("info")
                    .onClick(async () => {
                        this.queryWord(selection);
                    });
            });
        };
        // markdown 编辑模式 右键菜单
        this.registerEvent(
            this.app.workspace.on(
                "editor-menu",
                (menu: Menu, editor: Editor, view: MarkdownView) => {
                    let selection = editor.getSelection();
                    if (
                        selection ||
                        selection.trim().length === selection.length
                    ) {
                        addMemu(menu, selection);
                    }
                }
            )
        );
        // markdown 预览模式 右键菜单
        this.registerDomEvent(document.body, "contextmenu", (evt) => {
            if ((evt.target as HTMLElement).matchParent(".markdown-preview-view")) {
                const selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.preventDefault();
                let menu = new Menu();

                addMemu(menu, selection);

                menu.showAtMouseEvent(evt);
            }
        });
    }

    // 管理所有的左键抬起
    registerMouseup() {
        this.registerDomEvent(document.body, "mouseup", (evt) => {
            const target = evt.target as HTMLElement
            if (!target.matchParent(".stns")) { // 处理普通模式
                const funcKey = this.settings.function_key;
                if (funcKey === "disable" || evt[funcKey] === false) return;

                let selection = window.getSelection().toString().trim()
                if (!selection) return;

                this.queryWord(selection)
                return
            } else {	// 处理阅读模式下
                let start: Node
                let end: Node

                // test
                const selection = window.getSelection();

                if (!selection.isCollapsed) {
                    // if (selection.rangeCount === 0) return;
                    evt.preventDefault();
                    let range = selection.getRangeAt(0);
                    if (range.collapsed) return;

                    range.setStart(range.startContainer.parentNode, 0);
                    range.setEnd(range.endContainer.parentNode, 0);

                    if (
                        range.startContainer.parentNode !==
                        range.endContainer.parentNode
                    )
                        return;

                    start = range.startContainer;
                    end = range.endContainer;
                } else if (target.hasClass("word")) {
                    start = end = target
                } else {
                    return
                }

                // 保证最多只有一个select块
                let view = this.app.workspace.getActiveViewOfType(ReadingView)
                if (view) {
                    view.removeSelect()
                }

                if ((start as HTMLElement).matchParent(".select")) return

                let parent = start.parentNode;
                let newSpan = document.body.createSpan({ cls: "select" });
                parent.insertBefore(newSpan, start);

                let beginInsert = false;
                let collection = [] as any[];
                parent.childNodes.forEach((item) => {
                    if (item === newSpan) {
                        beginInsert = true;
                        return;
                    }
                    if (!beginInsert) return;
                    collection.push(item);
                    if (item === end) {
                        beginInsert = false;
                    }
                });
                collection.forEach((item) => {
                    newSpan.appendChild(item);
                });

                //selection.collapseToStart()
                this.queryWord(newSpan.innerText, newSpan)
            }
        })
    }

    // 管理所有的鼠标左击
    registerLeftClick() {
        this.registerDomEvent(document.body, "click", (evt) => {
            let target = evt.target as HTMLElement;
            if (target.classList.contains("word") ||
                target.classList.contains("select") ||
                target.classList.contains("phrase")
            ) {
                this.queryWord(target.textContent, target);
            } else if (
                !!target.matchParent(".text-area") &&
                !target.matchParent(".stns")
            ) {
                let selection = window.getSelection()
                if (!selection.isCollapsed) {
                    selection.collapseToStart()
                }

                // 消除select块
                let view =
                    this.app.workspace.getActiveViewOfType(ReadingView)
                if (view) {
                    view.removeSelect()
                }
            } else if (target.tagName === "H4" && target.matchParent("#sr-flashcard-view")) {
                let word = target.textContent;
                let accent = this.settings.review_prons
                let wordUrl = `http://dict.youdao.com/dictvoice?type=${accent}&audio=` + word.split(" ").join("%20");
                playAudio(wordUrl);
            }
        });
    }

    async loadSettings() {
        let settings: { [K in string]: any } = Object.assign({}, DEFAULT_SETTINGS)
        let data = await this.loadData()
        for (let key in DEFAULT_SETTINGS) {
            let k = key as keyof typeof DEFAULT_SETTINGS
            if (!data[k]) continue;

            if (typeof DEFAULT_SETTINGS[k] === "object") {
                Object.assign(settings[k], data[k])
            } else {
                settings[k] = data[k]
            }
        }
        (this.settings as any) = settings
        // this.settings = Object.assign(
        //     {},
        //     DEFAULT_SETTINGS,
        //     await this.loadData()
        // );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(VIEW_TYPE: string, side: "left" | "right" = "right") {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            if (side === "left") {
                await this.app.workspace.getLeftLeaf(false).setViewState({
                    type: VIEW_TYPE,
                    active: true,
                });
            } else {
                await this.app.workspace.getRightLeaf(false).setViewState({
                    type: VIEW_TYPE,
                    active: true,
                });
            }
        }

        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
    }
}


