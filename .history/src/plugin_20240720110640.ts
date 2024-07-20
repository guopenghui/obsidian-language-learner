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
    moment,
    MetadataCache,
} from "obsidian";
import { around } from "monkey-around";
import { createApp, App as VueApp,getCurrentInstance } from "vue";

import { SearchPanelView, SEARCH_ICON, SEARCH_PANEL_VIEW } from "./views/SearchPanelView";
import { READING_VIEW_TYPE, READING_ICON, ReadingView } from "./views/ReadingView";
import { LearnPanelView, LEARN_ICON, LEARN_PANEL_VIEW } from "./views/LearnPanelView";
import { StatView, STAT_ICON, STAT_VIEW_TYPE } from "./views/StatView";
import { DataPanelView, DATA_ICON, DATA_PANEL_VIEW } from "./views/DataPanelView";
import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";

import { t } from "./lang/helper";
import DbProvider from "./db/base";
import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
import { FileDb } from "./db/file_db";
import { TextParser,state } from "./views/parser";
import { FrontMatterManager } from "./utils/frontmatter";
import Server from "./api/server";

import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab } from "./settings";
import store from "./store";
import { playAudio } from "./utils/helpers";
import type { Position } from "./constant";
import { InputModal } from "./modals"

import Global from "./views/Global.vue";

import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span
} from "./db/interface";
import { ignorableWatch } from "@vueuse/core";

export const FRONT_MATTER_KEY: string = "langr";

export var imgnum: string = localStorage.getItem('imgnum') || '';


const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];

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
        this.db = await this.openDB();
        // this.settings.use_server
        //     ? new WebDb(this.settings.port)
        //     : new LocalDb(this);
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

        await this.replacePDF();

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

    async openDB(){
        if(this.settings.use_server){
            return new WebDb(this.settings.port)
        }else if(this.settings.only_fileDB){
            return new FileDb(this);
        }else{
            return new LocalDb(this);
        }
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(LEARN_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(DATA_PANEL_VIEW);
        this.app.workspace.detachLeavesOfType(STAT_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(READING_VIEW_TYPE);

        this.db.close();
        this.server?.close();
        if (await app.vault.adapter.exists(".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html")) {
            this.registerExtensions([PDF_FILE_EXTENSION], "pdf");
        }

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

    async replacePDF() {
        if (await app.vault.adapter.exists(
            ".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html"
        )) {
            this.registerView(VIEW_TYPE_PDF, (leaf) => {
                return new PDFView(leaf);
            });

            (this.app as any).viewRegistry.unregisterExtensions([
                PDF_FILE_EXTENSION,
            ]);
            this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

            this.registerDomEvent(window, "message", (evt) => {
                if (evt.data.type === "search") {
                    // if (evt.data.funckey || this.store.searchPinned)
                    this.queryWord(evt.data.selection);
                }
            });
        }
    }

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

    refreshReviewDb = async () => {
        if (!this.settings.review_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.review_database
        );
        if (!dataBase || "children" in dataBase) {
            new Notice("Invalid word database path");
            return;
        }

        let db = dataBase as TFile;
        let text = await this.app.vault.read(db);
        let oldRecord = {} as { [K in string]: string };
        text.match(/#word(\n.+)+\n(<!--SR.*?-->)/g)
            ?.map((v) => v.match(/#### (.+)[\s\S]+(<!--SR.*-->)/))
            ?.forEach((v) => {
                oldRecord[v[1]] = v[2];
            });

        // let data = await this.db.getExpressionAfter(this.settings.last_sync)
        let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z");
        if (data.length === 0) {
            // new Notice("Nothing new")
            return;
        }

        data.sort((a, b) => a.expression.localeCompare(b.expression));

        let newText = data.map((word) => {
            let notes = word.notes.length === 0
                ? ""
                : "**Notes**:\n" + word.notes.join("\n").trim() + "\n";
            let sentences = word.sentences.length === 0
                ? ""
                : "**Sentences**:\n" +
                word.sentences.map((sen) => {
                    return (
                        `*${sen.text.trim()}*` + "\n" +
                        (sen.trans ? sen.trans.trim() + "\n" : "") +
                        (sen.origin ? sen.origin.trim() : "")
                    );
                }).join("\n").trim() + "\n";

            return (
                `#word\n` +
                `#### ${word.expression}\n` +
                `${this.settings.review_delimiter}\n` +
                `${word.meaning}\n` +
                `${notes}` +
                `${sentences}` +
                (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "")
            );
        }).join("\n") + "\n";

        newText = "#flashcards\n\n" + newText;
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
                                .onClick(async () => { 
                                    processContent();
                                    await pluginSelf.setReadingView(this.leaf);
                                    await fetchData();                                   
                                    processContent();
                                });
                                    
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
                                        pluginSelf.markdownButtons["reading"] =
                                            (this.view as MarkdownView).addAction(
                                                "view",
                                                t("Open as Reading View"),
                                                async ()  => {
                                                    processContent();
                                                    await pluginSelf.setReadingView(this);
                                                    await fetchData();                                   
                                                    processContent();
                                                }
                                            );
                                        pluginSelf.markdownButtons["reading"].addClass("change-to-reading");
                                    }
                                } else {
                                    (this.view.actionsEl as HTMLElement)
                                        .querySelectorAll(".change-to-reading")
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
                target.matchParent("#sr-flashcard-view")
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


    async checkPath(){
        if(this.settings.word_folder&&this.settings.use_fileDB){
        try{
            await app.vault.createFolder(this.settings.word_folder);
        }catch(err){};}
    }

    async createWordfiles(words:string[]){
        await this.checkPath();
        var path = this.settings.word_folder;
        let info = await this.db.getExprall(words); //单词所有信息
        //this.createMd(exprs,this.plugin.settings.word_folder,cont); 
        for (const str of words) {
            if (path[path.length - 1] === '/') {
                var filePath = path+ `${str}.md`;
            } else {
                var filePath = path+ '/'+`${str}.md`;
            }
            var ExpressionInfo = info.find(info => info.expression === str);
            var fm = await this.createFM(ExpressionInfo);
            try{
                await app.vault.create(filePath,fm);
            }catch(err){
                if (err.message.includes('File already exists')){
                    this.app.vault.adapter.write(normalizePath(filePath),fm);
                }
    }}}

    //直接生成frontmatter文本
    async createFM(cont:ExpressionInfo){

        const status = statusMap[cont.status];
        const aliasesString = cont.aliases.length ? `aliases: \n${cont.aliases.map(line => `- ${line}`).join('\n')}` : '';
        const tagsString = cont.tags.length ? `tags: \n${cont.tags.map(line => `- ${line}`).join('\n')}` : '';
        const notesString = cont.notes.length ? `notes: \n${cont.notes.map(line => `- '${line}'`).join('\n')}` : '';
        //const sentencesString = cont.sentences.length ? `sentences: \n${cont.sentences.map(sentence => `- ${sentence.text}-${sentence.trans}-${sentence.origin}`).join('\n')}` : 'sentences: \n';
        let sentenceCounter = 1;
        const sentencesString = cont.sentences.length ? `${cont.sentences.map(sentence => {
            const result = `sentence${sentenceCounter}: '${sentence.text}'\ntrans${sentenceCounter}: '${sentence.trans}'\norigin${sentenceCounter}: '${sentence.origin}'`;
            sentenceCounter++;
            return result;
        }).join('\n')}` : '';
        // 格式化日期
        const formattedDate = moment.unix(cont.date).format('YYYY-MM-DD HH:mm:ss');
        var fm = `---
expression: ${cont.expression}
meaning: '${cont.meaning}'
${aliasesString}
date: ${formattedDate}
status: ${status}
type: ${cont.t}
${tagsString}
${notesString}
${sentencesString}
---
`;

        return fm;
    }

    async updateWordfiles(){
        let wordsinfo = await this.db.getAllExpressionSimple(false);
        let words: string[] = wordsinfo.map(item => item.expression);
        await this.createWordfiles(words);
    }

    async updateIndexDB(){
        let folderpath = this.settings.word_folder;
        await this.checkPath();
        var words = (await this.app.vault.adapter.list(normalizePath(folderpath))).files; 
        var ignorwords = (await this.db.getAllExpressionSimple(true))
            .filter(item => item.status === 0)
            .flatMap(item => [item.expression, ...item.aliases]);
        await this.db.destroyAll();
        await this.db.open();
        for(var wordpath of words){
            
            var expressioninfo = await this.parserFM(wordpath);
            ignorwords = ignorwords.filter(item => ![...expressioninfo.aliases,expressioninfo.expression].includes(item));
            let data = JSON.parse(JSON.stringify(expressioninfo));
	        (data as any).expression = (data as any).expression.trim().toLowerCase();
	        await this.db.postExpression(data);
        }
        this.db.postIgnoreWords(ignorwords.filter(item => item !== ""));
    }

    //解析某个单词文件的fm信息
    async parserFM(file_path:string){
        var fm = this.app.metadataCache.getCache(file_path).frontmatter;
        const {
            expression = '',
            meaning = '',
            status = '',
            type = '',
            tags = [],
            notes = [],
            aliases = [],
            date = ''
        } = fm;
        var sentences:Sentence[] = [];
        for(var i=1;i<Object.keys(fm).length;i++){
            var key = `sentence${i}`;
            
            if (key in fm) {
                let newSentence: Sentence = {
                    text: fm[key],
                    trans: fm[`trans${i}`],
                    origin: fm[`origin${i}`]
                };
                sentences.push(newSentence);
            }else{break;}     
        }
        var expressioninfo:ExpressionInfo = {
            expression : expression,
            meaning : meaning,
            status : statusMap.indexOf(status),
            t : type,
            tags : tags,
            notes : notes,
            aliases : aliases,
            date : moment.utc(date).unix(),
            sentences: sentences,
        }
        return expressioninfo;
    }

    //解析所有单词文件的fm信息
    async parserAllFM(){
        this.checkPath();
        var filesPath = (await this.app.vault.adapter.list(normalizePath(this.settings.word_folder))).files; 
        var wordsinfo:ExpressionInfo[] = [];
        for(var filepath of filesPath){
            var expressioninfo = await this.parserFM(filepath);
            wordsinfo.push(expressioninfo);
        }
        return wordsinfo;
    }



}



export function processContent(){
    // 获取包含特定class的元素
    console.log("进入了p");
    let textArea = document.querySelector('.text-area');
    
    if (textArea) {
        let htmlContent = textArea.innerHTML;
        //使用正则表达式匹配同时包含特定符号的 <p> 标签元素，并去除所有标签保留文本
        htmlContent = htmlContent.replace(/<p>(?=.*!)(?=.*\[)(?=.*\])(?=.*\()(?=.*\)).*<\/p>/g, function(match) {
            var pattern = /!\[(.*?)\]\((.*?)\)/;
            var str = match.replace(/<[^>]+>/g, '');
            var tq = pattern.exec(str);
            var img = document.createElement('img');
            var imgContainer = document.createElement('div');
            imgContainer.style.textAlign = 'center';  // 设置文本居中对齐
            var imgWrapper = document.createElement('div');
            imgWrapper.style.textAlign = 'center';  // 设置为内联块元素，使其水平居中

            if (tq) {
                var altText = tq[1];
                var srcUrl = tq[2];
                
                if (/^https?:\/\//.test(srcUrl)) {
                    img.alt = altText;
                    img.src = srcUrl;
                    imgWrapper.appendChild(img);
                    imgContainer.appendChild(imgWrapper);
                    return imgContainer.innerHTML; 
                }
                else{
                    img.alt = altText;
                    img.src =  mergeStrings(imgnum,srcUrl);
                    imgWrapper.appendChild(img);
                    imgContainer.appendChild(imgWrapper);
                    return imgContainer.innerHTML; 
                }
            }
            
        });
        // 替换 # 开头的文本为 h1
        htmlContent = htmlContent.replace(/(<span class="stns"># (.*?)<\/span>)(?=\s*<\/p>)/g, '<h1>$2</h1>');
        
        // 替换 ## 开头的文本为 h2
        htmlContent = htmlContent.replace(/(<span class="stns">)## (.*?)(<\/span>)(?=\s*<\/p>)/g, '$1<h2>$2</h2>$3');
        
        // 替换 ### 开头的文本为 h3
        htmlContent = htmlContent.replace(/(<span class="stns">### (.*?)<\/span>)(?=\s*<\/p>)/g, '<h3>$2</h3>');
        
        // 替换 #### 开头的文本为 h4
        htmlContent = htmlContent.replace(/(<span class="stns">#### (.*?)<\/span>)(?=\s*<\/p>)/g, '<h4>$2</h4>');
        
        // 替换 ##### 开头的文本为 h5
        htmlContent = htmlContent.replace(/(<span class="stns">##### (.*?)<\/span>)(?=\s*<\/p>)/g, '<h5>$2</h5>');
        //渲染粗体
        htmlContent = htmlContent.replace(/\*\*((?:.|\n)*?)\*\*/g, function(match, group1) {
            return ` <b>${group1}</b> `;
        });
        htmlContent = htmlContent.replace(/\_\_((?:.|\n)*?)\_\_/g, function(match, group1) {
            return ` <b>${group1}</b> `;
        });

        //渲染斜体
        htmlContent = htmlContent.replace(/ \*((?:.|\n)*?)\* /g, function(match, group1) {
            return ` <i>${group1}</i> `;
        });
        htmlContent = htmlContent.replace(/ \_((?:.|\n)*?)\_ /g, function(match, group1) {
            return ` <i>${group1}</i> `;
        });


        htmlContent = htmlContent.replace(/\~\~((?:.|\n)*?)\~\~/g, function(match, group1) {
            return ` <del>${group1}</del> `;
        });
        

        // 移除 "<span class="stns">!</span>" 标签
        //htmlContent = htmlContent.replace(/<span class="stns">!<\/span>/g, '');
        // 将修改后的HTML内容重新设置回元素
        textArea.innerHTML = htmlContent;
    } else {
        // 查找页面中的 img 元素并提取 imgnum 并存储到 localStorage 中
        var imgElements = document.getElementsByTagName('img');
        for (var i = 0; i < imgElements.length; i++) {
            if (imgElements[i].getAttribute('src')) {
                imgnum = imgElements[i].getAttribute('src');
                
                if (!imgnum.includes('http')) {
                    localStorage.setItem('imgnum', imgnum); // 存储到本地存储中
                    break; // 如果找到了，可以选择跳出循环
                }
            }
        }
    }
}

function mergeStrings(str1:string, str2:string) {
    // 获取 str2 的前 3 个字符
    let prefix = str2.substring(0, 3);
    // 在 str1 中查找 prefix 的位置
    let index = str1.indexOf(prefix);

    // 如果找到匹配的前缀
    if (index !== -1&& index !== 0 && str1.charAt(index - 1) === '/') {
        // 截断 str1 并与 str2 相连
        let firstPart = str1.substring(0, index);
        return firstPart + str2;
    } else {
        // 如果没有找到匹配的前缀，则返回 str1 和 str2 原样相连
        return str1 + str2;
    }
}

async function fetchData() {
    let previousContent = ''; // 上一次抓取到的内容
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(() => {
            let textArea = document.querySelector('.text-area');

            if (textArea) {
                let currentContent = textArea.innerHTML.trim();
                
                // 检查 textArea 中是否包含 class 为 'article' 的元素
                let hasArticleClass = textArea.querySelector('.article') !== null;

                if (hasArticleClass) {
                    clearInterval(intervalId); // 内容无变化时清除定时器
                    resolve(currentContent); // 解析 Promise，传递最终内容
                } else {
                    previousContent = currentContent; // 更新上一次抓取的内容
                }
            } else {
                clearInterval(intervalId); // 内容无变化时清除定时器
                console.warn('.text-area element not found');
            }
        }, 100);
    });
}