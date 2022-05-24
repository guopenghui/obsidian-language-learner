import { App, Notice, PluginSettingTab, Setting, moment } from "obsidian"

import { option } from "./api";
import LanguageLearner from "./plugin";


export interface MyPluginSettings {
    word_database: string;
    review_database: string;
    port: number;
    last_sync: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
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
            .setName("Word Database Path")
            .setDesc("Choose a md file as word database for auto-completion")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.word_database)
                    .onChange(async (path) => {
                        this.plugin.settings.word_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Server Port")
            .setDesc(
                'An integer between 1024-65535. It should be same as "PORT" variable in .env file of server'
            )
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.port))
                    .onChange(async (port) => {
                        let p = Number(port);
                        if (!isNaN(p) && p >= 1023 && p <= 65535) {
                            this.plugin.settings.port = p;
                            option.PORT = p;
                            await this.plugin.saveSettings();
                        } else {
                            new Notice("Wrong port format");
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Review Database Path")
            .setDesc("Choose a md file as review database for spaced-repetition")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.review_database)
                    .onChange(async (path) => {
                        this.plugin.settings.review_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Last review sync")
            .setDesc("Last time the review database was updated")
            .addMomentFormat(date =>
                date
                    .setValue(moment.utc(this.plugin.settings.last_sync).local().format())

            ).setDisabled(true)
    }
}