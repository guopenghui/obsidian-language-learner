import { App, Notice, PluginSettingTab, Setting, Modal, moment } from "obsidian"

import { WebDb } from "./db/web_db";
import LanguageLearner from "./plugin";
import { t } from "./lang/helper"

export interface MyPluginSettings {
    use_server: boolean;
    word_database: string;
    review_database: string;
    port: number;
    last_sync: string;
    db_name: string;
    review_prons: "0" | "1"
    default_paragraphs: string
    col_delimiter: "," | "\t" | "|"
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    use_server: false,
    word_database: null,
    review_database: null,
    port: 8086,
    last_sync: "1970-01-01T00:00:00Z",
    db_name: "WordDB",
    review_prons: "0",
    default_paragraphs: "4",
    col_delimiter: ","
}

export class SettingTab extends PluginSettingTab {
    plugin: LanguageLearner;

    constructor(app: App, plugin: LanguageLearner) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl("h1", { text: "Settings for Language Learner" });

        new Setting(containerEl)
            .setName(t("Use Server"))
            .setDesc(t("Use a seperated backend server"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use_server)
                .onChange(async (use_server) => {
                    this.plugin.settings.use_server = use_server
                    await this.plugin.saveSettings()
                })
            )

        new Setting(containerEl)
            .setName(t("Server Port"))
            .setDesc(
                t('An integer between 1024-65535. It should be same as "PORT" variable in .env file of server')
            )
            .setDisabled(!this.plugin.settings.use_server)
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.port))
                    .onChange(async (port) => {
                        let p = Number(port);
                        if (!isNaN(p) && p >= 1023 && p <= 65535) {
                            this.plugin.settings.port = p;
                            (this.plugin.db as WebDb).port = p
                            await this.plugin.saveSettings();
                        } else {
                            new Notice(t("Wrong port format"));
                        }
                    })
            );

        containerEl.createEl("h3", { text: t("IndexDB Database") });

        new Setting(containerEl)
            .setName(t("Database Name"))
            .setDesc(t("Reopen app after changing database name"))
            .addText(text => text
                .setValue(this.plugin.settings.db_name)
                .onChange(async (name) => {
                    this.plugin.settings.db_name = name
                    this.plugin.saveSettings()
                })
            )

        // 导入导出数据库
        new Setting(containerEl)
            .setName(t("Import & Export"))
            .setDesc(t("Warning: Import will override current database"))
            .addButton(button => button
                .setButtonText(t("Import"))
                .onClick(async () => {
                    let modal = new OpenFileModal(this.plugin.app, async (file: File) => {
                        // let fr = new FileReader()
                        // fr.onload = async () => {
                        // let data = JSON.parse(fr.result as string)
                        await this.plugin.db.importDB(file)
                        new Notice("Imported")
                        // }
                        // fr.readAsText(file)
                    })
                    modal.open()
                })
            )
            .addButton(button => button
                .setButtonText(t("Export"))
                .onClick(async () => {
                    await this.plugin.db.exportDB()
                    new Notice("Exported")
                })
            )

        // 获取所有无视单词
        new Setting(containerEl)
            .setName(t("Get all ignores"))
            .addButton(button => button
                .setButtonText(t("Export"))
                .onClick(async () => {
                    let words = await this.plugin.db.getExpressionSimple(true)
                    let ignores = words.filter(w => w.status === 0).map(w => w.expression)
                    await navigator.clipboard.writeText(ignores.join("\n"))
                    new Notice(t("Ignores are copied to the clipboard"))
                })
            )

        new Setting(containerEl)
            .setName(t("Word Database Path"))
            .setDesc(t("Choose a md file as word database for auto-completion"))
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.word_database)
                    .onChange(async (path) => {
                        this.plugin.settings.word_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Review Database Path"))
            .setDesc(t("Choose a md file as review database for spaced-repetition"))
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.review_database)
                    .onChange(async (path) => {
                        this.plugin.settings.review_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Last review sync"))
            .setDesc(t("Last time the review database was updated"))
            .addMomentFormat(date => date
                .setValue(moment.utc(this.plugin.settings.last_sync).local().format())
                .setDisabled(true)
            )
            .addButton(button => button
                .setButtonText(t("Reset"))
                .setWarning()
                .onClick(async (evt) => {
                    let modal = new WarningModal(
                        this.app,
                        t("Are you sure you want to reset last sync time?"),
                        async () => {
                            this.plugin.settings.last_sync = "1970-01-01T00:00:00Z"
                            await this.plugin.saveSettings()
                        }
                    )
                    modal.open()
                }))


        new Setting(containerEl)
            .setName(t("Destroy Database"))
            .setDesc(t("Destroy all stuff and start over"))
            .addButton(button => button
                .setButtonText(t("Destroy"))
                .setWarning()
                .onClick(async (evt) => {
                    let modal = new WarningModal(
                        this.app,
                        t("Are you sure you want to destroy your database?"),
                        async () => {
                            await this.plugin.db.destroyAll()
                            new Notice("啊啊啊")
                        })
                    modal.open()
                })
            )

        containerEl.createEl("h3", { text: t("Reading Mode") })
        new Setting(containerEl)
            .setName(t("Default Paragraphs"))
            .addDropdown(num => num
                .addOption("2", "1")
                .addOption("4", "2")
                .addOption("8", "4")
                .addOption("16", "8")
                .addOption("32", "16")
                .addOption("all", "All")
                .setValue(this.plugin.settings.default_paragraphs)
                .onChange(async (value: string) => {
                    this.plugin.settings.default_paragraphs = value
                    await this.plugin.saveSettings()
                })
            )


        containerEl.createEl("h3", { text: t("Auto Completion") })

        new Setting(containerEl)
            .setName(t("Column delimiter"))
            .addDropdown(dilimiter => dilimiter
                .addOption(",", t("Comma"))
                .addOption("\t", t("Tab"))
                .addOption("|", t("Pipe"))
                .setValue(this.plugin.settings.col_delimiter)
                .onChange(async (value: "," | "\t" | "|") => {
                    this.plugin.settings.col_delimiter = value
                    await this.plugin.saveSettings()
                })
            )

        containerEl.createEl("h3", { text: t("Review") });

        new Setting(containerEl)
            .setName(t("Accent"))
            .setDesc(t("Choose your preferred accent"))
            .addDropdown(accent => accent
                .addOption("0", t("American"))
                .addOption("1", t("British"))
                .setValue(this.plugin.settings.review_prons)
                .onChange(async (value: "0" | "1") => {
                    this.plugin.settings.review_prons = value
                    await this.plugin.saveSettings()
                })
            )
    }
}


// 打开某个文件
class OpenFileModal extends Modal {
    input: HTMLInputElement
    file: File
    onSubmit: (file: File) => Promise<void>
    constructor(app: App, onSubmit: (file: File) => Promise<void>) {
        super(app)
        this.onSubmit = onSubmit
    }

    onOpen() {
        const { contentEl } = this

        this.input = contentEl.createEl("input", {
            attr: {
                type: "file"
            }
        })

        this.input.addEventListener("change", () => {
            this.file = this.input.files[0]
        })

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(t("Yes"))
                .onClick((evt) => {
                    this.onSubmit(this.file)
                    this.close()
                })
            )
    }

    onClose(): void {

    }
}


// 做某些危险操作前问一句
export class WarningModal extends Modal {
    onSubmit: () => Promise<void>;
    message: string;

    constructor(app: App, message: string, onSubmit: () => Promise<void>) {
        super(app)
        this.message = message
        this.onSubmit = onSubmit
    }

    onOpen() {
        const { contentEl } = this

        contentEl.createEl("h2", { text: this.message })

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText(t("Yes"))
                .setWarning()
                .setCta()
                .onClick(() => {
                    this.close()
                    this.onSubmit()
                })
            )
            .addButton((btn) => btn
                .setButtonText(t("No!!!"))
                .setCta() // what is this?
                .onClick(() => {
                    this.close()
                }))
    }

    onClose() {
        let { contentEl } = this
        contentEl.empty()
    }
}