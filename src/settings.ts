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
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    use_server: false,
    word_database: null,
    review_database: null,
    port: 8086,
    last_sync: "1970-01-01T00:00:00Z"
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
        containerEl.createEl("h2", { text: "Settings for Language Learner" });

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