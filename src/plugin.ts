import {
    Notice,
    Plugin,
    Menu,
    WorkspaceLeaf,
    ViewState,
    MarkdownView,
    Editor,
    TFile,
    normalizePath,
    Platform,
    requestUrl,
} from "obsidian";
import { around } from "monkey-around";
import { createApp, App as VueApp } from "vue";

import { SearchPanelView, SEARCH_ICON, SEARCH_PANEL_VIEW } from "./views/SearchPanelView";
import { READING_VIEW_TYPE, READING_ICON, ReadingView } from "./views/ReadingView";
import { LearnPanelView, LEARN_ICON, LEARN_PANEL_VIEW } from "./views/LearnPanelView";
import { StatView, STAT_ICON, STAT_VIEW_TYPE } from "./views/StatView";
import { DataPanelView, DATA_ICON, DATA_PANEL_VIEW } from "./views/DataPanelView";
// import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";

import { t } from "./lang/helper";
import DbProvider from "./db/base";
import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
import { TextParser } from "./views/parser";
import { FrontMatterManager } from "./utils/frontmatter";
import Server from "./api/server";

import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab } from "./settings";
import store from "./store";
import { playAudio } from "./utils/helpers";
import type { Position } from "./constant";
import { InputModal } from "./modals"

import Global from "./views/Global.vue";



export const FRONT_MATTER_KEY: string = "langr";

export default class LanguageLearner extends Plugin {
    constants: { basePath: string; platform: "mobile" | "desktop"; };
    settings: MyPluginSettings;
    appEl: HTMLElement;
    vueApp: VueApp;
    db: DbProvider;
    server: Server;
    parser: TextParser;
    markdownButtons: Record<string, HTMLElement> = {};
    frontManager: FrontMatterManager;
    store: typeof store = store;

    async onload() {
        // 读取设置
        await this.loadSettings();
        this.addSettingTab(new SettingTab(this.app, this));

        this.registerConstants();

        // 打开数据库
        this.db = this.settings.use_server
            ? new WebDb(
                this.settings.host,
                this.settings.port,
                this.settings.use_https,
                this.settings.api_key
                )
            : new LocalDb(this);
        await this.db.open();

        // 设置解析器
        this.parser = new TextParser(this);
        this.frontManager = new FrontMatterManager(this.app);

        // 打开内置服务器
        this.server = this.settings.self_server
            ? new Server(this, this.settings.self_port)
            : null;
        await this.server?.start();

        // test
        // this.addCommand({
        // 	id: "langr-test",
        // 	name: "Test for langr",
        // 	callback: () => new Notice("hello!")
        // })

        // await this.replacePDF();

        this.initStore();

        this.addCommands();
        this.registerCustomViews();
        this.registerReadingToggle();
        this.registerContextMenu();
        this.registerLeftClick();
        this.registerMouseup();
        this.registerEvent(
            this.app.workspace.on("css-change", () => {
                store.dark = document.body.hasClass("theme-dark");
                store.themeChange = !store.themeChange;
            })
        );

        // 创建全局app用于各种浮动元素
        this.appEl = document.body.createDiv({ cls: "langr-app" });
        this.vueApp = createApp(Global);
        this.vueApp.config.globalProperties.plugin = this;
        this.vueApp.mount(this.appEl);
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(LEARN_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(DATA_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(STAT_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(READING_VIEW_TYPE);

        this.db.close();
        this.server?.close();
        // if (await app.vault.adapter.exists(".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html")) {
        //     this.registerExtensions([PDF_FILE_EXTENSION], "pdf");
        // }

        this.vueApp.unmount();
        this.appEl.remove();
        this.appEl = null;
    }

    registerConstants() {
        this.constants = {
            basePath: normalizePath((this.app.vault.adapter as any).basePath),
            platform: Platform.isMobile ? "mobile" : "desktop",
        };
    }

    // async replacePDF() {
    //     if (await app.vault.adapter.exists(
    //         ".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html"
    //     )) {
    //         this.registerView(VIEW_TYPE_PDF, (leaf) => {
    //             return new PDFView(leaf);
    //         });

    //         (this.app as any).viewRegistry.unregisterExtensions([
    //             PDF_FILE_EXTENSION,
    //         ]);
    //         this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

    //         this.registerDomEvent(window, "message", (evt) => {
    //             if (evt.data.type === "search") {
    //                 // if (evt.data.funckey || this.store.searchPinned)
    //                 this.queryWord(evt.data.selection);
    //             }
    //         });
    //     }
    // }

    initStore() {
        this.store.dark = document.body.hasClass("theme-dark");
        this.store.themeChange = false;
        this.store.fontSize = this.settings.font_size;
        this.store.fontFamily = this.settings.font_family;
        this.store.lineHeight = this.settings.line_height;
        this.store.popupSearch = this.settings.popup_search;
        this.store.searchPinned = false;
        this.store.dictsChange = false;
        this.store.dictHeight = this.settings.dict_height;
    }

    addCommands() {
        // 注册刷新单词数据库命令
        this.addCommand({
            id: "langr-refresh-word-database",
            name: t("Refresh Word Database"),
            callback: this.refreshWordDb,
        });

        // 注册刷新复习数据库命令
        this.addCommand({
            id: "langr-refresh-review-database",
            name: t("Refresh Review Database"),
            callback: this.refreshReviewDb,
        });

        // 注册查词命令
        this.addCommand({
            id: "langr-search-word-select",
            name: t("Translate Select"),
            callback: () => {
                let selection = window.getSelection().toString().trim();
                this.queryWord(selection);
            },
        });
        this.addCommand({
            id: "langr-search-word-input",
            name: t("Translate Input"),
            callback: () => {
                const modal = new InputModal(this.app, (text) => {
                    this.queryWord(text);
                });
                modal.open();
            },
        });
        this.addCommand({
            id: "langr-generate-article",
            name: t("Generate Article"),
            hotkeys: [{ modifiers: ['Alt'], key: 'g' }],
            callback: this.generateArticle,
        });
    }

    registerCustomViews() {
        // 注册查词面板视图
        this.registerView(
            SEARCH_PANEL_VIEW,
            (leaf) => new SearchPanelView(leaf, this)
        );
        this.addRibbonIcon(SEARCH_ICON, t("Open word search panel"), (evt) => {
            this.activateView(SEARCH_PANEL_VIEW, "left");
        });

        // 注册新词面板视图
        this.registerView(
            LEARN_PANEL_VIEW,
            (leaf) => new LearnPanelView(leaf, this)
        );
        this.addRibbonIcon(LEARN_ICON, t("Open new word panel"), (evt) => {
            this.activateView(LEARN_PANEL_VIEW, "right");
        });

        // 注册阅读视图
        this.registerView(
            READING_VIEW_TYPE,
            (leaf) => new ReadingView(leaf, this)
        );

        //注册统计视图
        this.registerView(STAT_VIEW_TYPE, (leaf) => new StatView(leaf, this));
        this.addRibbonIcon(STAT_ICON, t("Open statistics"), async (evt) => {
            this.activateView(STAT_VIEW_TYPE, "right");
        });

        //注册单词列表视图
        this.registerView(
            DATA_PANEL_VIEW,
            (leaf) => new DataPanelView(leaf, this)
        );
        this.addRibbonIcon(DATA_ICON, t("Data Panel"), async (evt) => {
            this.activateView(DATA_PANEL_VIEW, "tab");
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
        (this.app as any).commands.executeCommandById(
            "various-complements:reload-custom-dictionaries"
        );
    }

    refreshWordDb = async () => {
        if (!this.settings.word_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );
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

        let del = this.settings.col_delimiter;

        // 正向查询
        let classified_texts = classified.map((w, idx) => {
            return (
                `#### ${statusMap[idx]}\n` +
                w.map((i) => `${words[i].expression}${del}    ${words[i].meaning}`)
                    .join("\n") + "\n"
            );
        });
        classified_texts.shift();
        let word2Meaning = classified_texts.join("\n");

        // 反向查询
        let meaning2Word = classified
            .flat()
            .map((i) => `${words[i].meaning}  ${del}  ${words[i].expression}`)
            .join("\n");

        let text = word2Meaning + "\n\n" + "#### 反向查询\n" + meaning2Word;
        let db = dataBase as TFile;
        this.app.vault.modify(db, text);
    };

    generateArticle = async () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.file) {
            new Notice("Please open a Markdown file first.");
            return;
        }

        const file = activeView.file;
        let fileContent = await this.app.vault.read(file);
        const url = this.app.metadataCache.getFileCache(file)?.frontmatter?.['langr-article-url'];

        if (!url) {
            new Notice("Missing 'langr-article-url' in front matter.");
            return;
        }

        const articlePlaceholder = '^^^article';
        const wordsPlaceholder = '^^^words';

        if (!fileContent.includes(articlePlaceholder) || !fileContent.includes(wordsPlaceholder)) {
            new Notice(`Missing required placeholders: ${articlePlaceholder} and ${wordsPlaceholder}.`);
            return;
        }

        try {
            const response = await requestUrl({ url });

            if (response.status !== 200) {
                new Notice(`Failed to fetch URL. Status: ${response.status}`);
                return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.text, 'text/html');

            // --- 新的标题提取逻辑 ---
            const titleElement = doc.querySelector('title');
            let newTitle = null;
            if (titleElement) {
                const titleText = titleElement.textContent.trim();
                const parts = titleText.split('/');
                if (parts.length > 1) {
                    newTitle = parts[parts.length - 1].trim();
                } else {
                    newTitle = titleText;
                }
            }

            if (newTitle) {
                newTitle = newTitle.replace(/[.!?。！？]$/, '');
                
                const parentPath = file.parent.path === '/' ? '' : file.parent.path;
                const newFilePath = `${parentPath}/${newTitle}.md`;
                
                try {
                    // await 会等待 Promise 完成，如果失败，就会跳到 catch 块
                    await this.app.vault.rename(file, newFilePath);
                } catch (e) {
                    // 使用 new Notice() 显示一个错误通知
                    new Notice(`Error: ${e.message}`);
                    console.error("Error:", e);
                    return;
                }
                
                const originValue = `《${newTitle}》`;
                
                let frontMatterRegex = /^---\n([\s\S]*?)\n---/;
                let newFrontMatter = `langr-origin: ${originValue}`;
                
                if (frontMatterRegex.test(fileContent)) {
                    fileContent = fileContent.replace(frontMatterRegex, (match, p1) => {
                        if (!p1.includes('langr-origin:')) {
                            return `---\n${p1}\n${newFrontMatter}\n---`;
                        } else {
                            return match.replace(/langr-origin: .*/, newFrontMatter);
                        }
                    });
                } else {
                    fileContent = `---\n${newFrontMatter}\n---\n\n${fileContent}`;
                }
            }

            const parentDivSelector = ".widget.widget-richtext > div";
            const parentDiv = doc.querySelector(parentDivSelector) as HTMLElement;
            
            if (!parentDiv) {
                new Notice("Could not find the content container element.");
                return;
            }
            
            const evaluateXPath = (xpath: string, contextNode: Node = doc): Node | null => {
                const result = doc.evaluate(xpath, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                return result.singleNodeValue;
            };

            const startElementXPath = "//h3[contains(text(), 'Vocabulary')]";
            const startElement = evaluateXPath(startElementXPath) as Element;

            if (!startElement) {
                new Notice("Could not find the 'VOCABULARY' section. Website structure may have changed.");
                return;
            }

            let markdownContent = '';
            let currentNode: Element | null = startElement;

            const processChildren = (element: Element): string => {
                let childrenOutput = '';
                element.childNodes.forEach(child => {
                    // console.log('Processing child:', child);
                    if (child.nodeType === Node.TEXT_NODE) {
                        // console.log('Processing text node:', child.textContent);
                        if( child.textContent.trim() !== '') {
                            childrenOutput += child.textContent;    
                        }
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const subElement = child as Element;
                        // console.log('Processing element node:',subElement.tagName, subElement.innerHTML);
                        switch (subElement.tagName) {
                            case 'STRONG':
                                // 检查是否是 '<strong>&nbsp;</strong>'
                                if (subElement.innerHTML.trim() === '&nbsp;') {
                                    break; // 直接忽略
                                }
                                // 检查是否是 '<strong><br></strong>'
                                if (subElement.firstElementChild && subElement.firstElementChild.tagName === 'BR' && subElement.children.length === 1) {
                                    childrenOutput += '\n\n'; // 只添加换行，不加粗
                                    break;
                                }

                                const strongContent = processChildren(subElement);
                                // console.log('Strong content:', strongContent);
                                if(strongContent === "TRANSCRIPT"){
                                    childrenOutput += `### Transcipt\n\n`;
                                } else {
                                    childrenOutput += `${strongContent}`;
                                }
                                break;
                            case 'BR':
                                childrenOutput += '\n\n';
                                break;
                            default:
                                childrenOutput += processChildren(subElement);
                                break;
                        }
                    }
                    // console.log('After processing:', childrenOutput);
                });
                return childrenOutput;
            };

            while (currentNode) {
                if (currentNode.tagName === 'H3') {
                    markdownContent += `### Vocabulary\n\n`;
                } else if (currentNode.tagName === 'P') {
                    const processedText = processChildren(currentNode);
                    markdownContent += `${processedText.trim()}\n\n`;
                }
                
                currentNode = currentNode.nextElementSibling;
                if (!currentNode || !parentDiv.contains(currentNode)) {
                    break;
                }
            }
            
            if (!markdownContent) {
                new Notice("Extracted article content is empty.");
                return;
            }

            const placeholderStartIndex = fileContent.indexOf(articlePlaceholder) + articlePlaceholder.length;
            const placeholderEndIndex = fileContent.indexOf(wordsPlaceholder);

            if (placeholderStartIndex >= placeholderEndIndex) {
                new Notice("Placeholder order is incorrect. `^^^article` must come before `^^^words`.");
                return;
            }

            const newContent = fileContent.substring(0, placeholderStartIndex) +
                             `\n\n${markdownContent.trim()}\n\n` +
                             fileContent.substring(placeholderEndIndex);

            await this.app.vault.modify(file, newContent);
            new Notice("Article content successfully generated and inserted!");

        } catch (error) {
            console.error("Failed to generate article:", error);
            new Notice("An error occurred. Check the console for details.");
        }
    };

    refreshReviewDb = async () => {
        if (!this.settings.review_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.review_database
        );
        // console.log("refreshReviewDb", this.settings.review_database);
        if (!dataBase || "children" in dataBase) {
            new Notice("Invalid word database path");
            return;
        }

        // console.log("database", dataBase);
        let db = dataBase as TFile;
        let text = await this.app.vault.read(db);
        // console.log("text : ", text);
        let oldRecord = {} as { [K in string]: string };
        //这段逻辑猜测可能是Spaced Repetition的记录信息
        text.match(/#word(\n.+)+\n(<!--SR.*?-->)/g)
            ?.map((v) => v.match(/单词: (.+)[\s\S]+(<!--SR.*-->)/))
            ?.forEach((v) => {
                oldRecord[v[1]] = v[2];
            });
        // console.log("oldRecord", oldRecord);

        let oldAnkiCardIdRecords = {} as { [K in string]: string };
        // 新增的处理anki card id的逻辑
        text.match(/#word(\n.+)+\n(<!--ID.*?-->)/g)
            ?.map((v) => v.match(/单词: (.+)[\s\S]+(<!--ID.*-->)/))
            ?.forEach((v) => {
                oldAnkiCardIdRecords[v[1]] = v[2];
            });

        // The `?.` checks if the match result is null or undefined.
        // If it is, the expression evaluates to null or undefined.
        // The `??` then provides the default value "English".
        let deckName = text.match(/TARGET DECK: (.+?)\n/)?.[1] ?? "English";

        // The rest of your original logic to handle empty or "null" strings
        if (deckName.trim() === "" || deckName.trim() === "null") {
        deckName = "English";
        }

        // let data = await this.db.getExpressionAfter(this.settings.last_sync)
        let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z");
        if (data.length === 0) {
            // new Notice("Nothing new")
            return;
        }
        console.log("data: ", data);

        data.sort((a, b) => a.expression.localeCompare(b.expression));

        let newText = data.map((word) => {
            let notes = word.notes.length === 0
                ? ""
                : word.notes.join("\n\n").trim();
            let sentences = word.sentences.length === 0
                ? ""
                : word.sentences.map((sen) => {
                    return (
                        `*${sen.text.trim()}*` + "\n" +
                        (sen.trans ? sen.trans.trim() + "\n" : "") +
                        (sen.origin ? "----------------------------" + sen.origin.trim() : "")
                    );
                }).join("\n\n").trim();

            // 下面是我改动的输出格式，适配
            return (
                `#word\n` +
                "START\n" +
                "import_word_from_obsidian\n" + 
                `单词: ${word.expression}\n` +
                `释义: ${word.meaning}\n` +
                `例句: ${sentences}\n` +
                `笔记: ${notes}\n` +
                (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "") +
                (oldAnkiCardIdRecords[word.expression] ? oldAnkiCardIdRecords[word.expression] + "\n" : "")+
                "END\n"
            );

            // 原有的输出格式
            // return (
            //     `#word\n` +
            //     `#### ${word.expression}\n` +
            //     `${this.settings.review_delimiter}\n` +
            //     `${word.meaning}\n` +
            //     `${notes}` +
            //     `${sentences}` +
            //     (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "") +
            //     (oldAnkiCardIdRecords[word.expression] ? oldAnkiCardIdRecords[word.expression] + "\n" : "")
            // );
        }).join("\n") + "\n";

        newText = "#flashcards\n\n" + "TARGET DECK: " + deckName + "\n\n" + newText;
        await this.app.vault.modify(db, newText);

        this.saveSettings();
    };

    // 在MardownView的扩展菜单加一个转为Reading模式的选项
    registerReadingToggle = () => {
        const pluginSelf = this;
        pluginSelf.register(
            around(MarkdownView.prototype, {
                onPaneMenu(next) {
                    return function (m: Menu) {
                        const file = this.file;
                        const cache = file.cache
                            ? pluginSelf.app.metadataCache.getFileCache(file)
                            : null;

                        if (!file ||
                            !cache?.frontmatter ||
                            !cache?.frontmatter[FRONT_MATTER_KEY]
                        ) {
                            return next.call(this, m);
                        }

                        m.addItem((item) => {
                            item.setTitle(t("Open as Reading View"))
                                .setIcon(READING_ICON)
                                .onClick(() => { pluginSelf.setReadingView(this.leaf); });
                        });

                        next.call(this, m);
                    };
                },
            })
        );

        // 增加标题栏切换阅读模式和mardown模式的按钮
        pluginSelf.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(next) {
                    return function (state: ViewState, ...rest: any[]): Promise<void> {
                        return (next.apply(this, [state, ...rest]) as Promise<void>).then(() => {
                            if (state.type === "markdown" && state.state?.file) {
                                const cache = pluginSelf.app.metadataCache
                                    .getCache(state.state.file);
                                if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
                                    if (!pluginSelf.markdownButtons["reading"]) {
                                        // 在软件初始化的时候，view上面可能没有 addAction 这个方法
                                        setTimeout(() => {
                                            pluginSelf.markdownButtons["reading"] =
                                                (this.view as MarkdownView).addAction(
                                                    "view",
                                                    t("Open as Reading View"),
                                                    () => {
                                                        pluginSelf.setReadingView(this);
                                                    }
                                                );
                                            pluginSelf.markdownButtons["reading"].addClass("change-to-reading");

                                        })
                                    }
                                } else {
                                    // 在软件初始化的时候，view上面可能没有 actionsEl 这个字段
                                    (this.view.actionsEl as HTMLElement)
                                        ?.querySelectorAll(".change-to-reading")
                                        .forEach(el => el.remove());
                                    // pluginSelf.markdownButtons["reading"]?.remove();
                                    pluginSelf.markdownButtons["reading"] = null;
                                }
                            } else {
                                pluginSelf.markdownButtons["reading"] = null;
                            }
                        });
                    };
                },
            })
        );
    };

    async queryWord(word: string, target?: HTMLElement, evtPosition?: Position): Promise<void> {
        if (!word) return;

        if (!this.settings.popup_search) {
            await this.activateView(SEARCH_PANEL_VIEW, "left");
        }

        if (target && Platform.isDesktopApp) {
            await this.activateView(LEARN_PANEL_VIEW, "right");
        }

        dispatchEvent(new CustomEvent('obsidian-langr-search', {
            detail: { selection: word, target, evtPosition }
        }));

        if (this.settings.auto_pron) {
            let accent = this.settings.review_prons;
            let wordUrl =
                `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                encodeURIComponent(word);
            playAudio(wordUrl);
        }
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
                    if (selection || selection.trim().length === selection.length) {
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
        this.registerDomEvent(document.body, "pointerup", (evt) => {
            const target = evt.target as HTMLElement;
            if (!target.matchParent(".stns")) {
                // 处理普通模式
                const funcKey = this.settings.function_key;
                if ((funcKey === "disable" || evt[funcKey] === false)
                    && !(this.store.searchPinned && !target.matchParent("#langr-search,#langr-learn-panel"))
                ) return;

                let selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.stopImmediatePropagation();
                this.queryWord(selection, null, { x: evt.pageX, y: evt.pageY });
                return;
            }
        });
    }

    // 管理所有的鼠标左击
    registerLeftClick() {
        this.registerDomEvent(document.body, "click", (evt) => {
            let target = evt.target as HTMLElement;
            if (
                target.tagName === "H4" &&
                target.matchParent(".sr-modal-content")
            ) {
                let word = target.textContent;
                let accent = this.settings.review_prons;
                let wordUrl =
                    `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                    encodeURIComponent(word);
                playAudio(wordUrl);
            }
        });
    }

    async loadSettings() {
        let settings: { [K in string]: any } = Object.assign(
            {},
            DEFAULT_SETTINGS
        );
        let data = (await this.loadData()) || {};
        for (let key in DEFAULT_SETTINGS) {
            let k = key as keyof typeof DEFAULT_SETTINGS;
            if (data[k] === undefined) {
                continue;
            }

            if (typeof DEFAULT_SETTINGS[k] === "object") {
                Object.assign(settings[k], data[k]);
            } else {
                settings[k] = data[k];
            }
        }
        (this.settings as any) = settings;
        // this.settings = Object.assign(
        //     {},
        //     DEFAULT_SETTINGS,
        //     await this.loadData()
        // );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(VIEW_TYPE: string, side: "left" | "right" | "tab") {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            let leaf;
            switch (side) {
                case "left":
                    leaf = this.app.workspace.getLeftLeaf(false);
                    break;
                case "right":
                    leaf = this.app.workspace.getRightLeaf(false);
                    break;
                case "tab":
                    leaf = this.app.workspace.getLeaf("tab");
                    break;
            }
            await leaf.setViewState({
                type: VIEW_TYPE,
                active: true,
            });
        }
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
    }
}
