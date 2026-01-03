import { text } from "node:stream/consumers";
import { App, Modal, Setting, Notice } from "obsidian";
import { t } from "./lang/helper";

// 输入文字
class InputModal extends Modal {
    text: string = "";
    onSubmit: (text: string) => void;
    constructor(app: App, onSubmit: (text: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", {
            text: "Input Text",
            attr: {
                style: "margin: 10px 0;",
            }
        });

        let inputEl = contentEl.createEl("input", {
            attr: {
                type: "text",
                style: "width: 100%;"
            }
        });

        inputEl.addEventListener("input", (evt) => {
            this.text = inputEl.value;
        });

        inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                evt.stopPropagation();
                this.onSubmit(this.text);
                this.close();
            }
        });
    }
}

// 打开某个文件
class OpenFileModal extends Modal {
    input: HTMLInputElement;
    file: File;
    onSubmit: (file: File) => Promise<void>;
    constructor(app: App, onSubmit: (file: File) => Promise<void>) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        this.input = contentEl.createEl("input", {
            attr: {
                type: "file"
            }
        });

        this.input.addEventListener("change", () => {
            this.file = this.input.files[0];
        });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(t("Yes"))
                .onClick((evt) => {
                    this.onSubmit(this.file);
                    this.close();
                })
            );
    }

    onClose(): void {

    }
}

// 做某些危险操作前问一句
class WarningModal extends Modal {
    onSubmit: () => Promise<void>;
    message: string;

    constructor(app: App, message: string, onSubmit: () => Promise<void>) {
        super(app);
        this.message = message;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.message });

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText(t("Yes"))
                .setWarning()
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit();
                })
            )
            .addButton((btn) => btn
                .setButtonText(t("No!!!"))
                .setCta() // what is this?
                .onClick(() => {
                    this.close();
                }));
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

// Import format selection modal
class ImportFormatModal extends Modal {
    selectedFormat: 'json' | 'csv' | 'sqlite3' = 'json';
    onSubmit: (format: 'json' | 'csv' | 'sqlite3', file: File) => Promise<void>;
    input: HTMLInputElement;
    file: File;

    constructor(app: App, onSubmit: (format: 'json' | 'csv' | 'sqlite3', file: File) => Promise<void>) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h3', { text: t('Import from File') });

        // Format selection
        new Setting(contentEl)
            .setName(t('File Format'))
            .setDesc(t('Select the format of the file to import'))
            .addDropdown(dropdown => dropdown
                .addOption('json', 'JSON')
                .addOption('csv', 'CSV')
                .addOption('sqlite3', 'SQLite3')
                .setValue('json')
                .onChange((value: 'json' | 'csv' | 'sqlite3') => {
                    this.selectedFormat = value;
                })
            );

        // Format descriptions
        const formatDescEl = contentEl.createDiv({
            attr: {
                style: 'margin: 10px 0; padding: 10px; background: var(--background-secondary); border-radius: 5px;'
            }
        });

        const updateFormatDesc = () => {
            formatDescEl.empty();
            let desc = '';
            switch (this.selectedFormat) {
                case 'json':
                    desc = t('JSON format: Array of word objects with expression, meaning, status, type, tags, etc.');
                    break;
                case 'csv':
                    desc = t('CSV format: Expression,Meaning,Status,Type,Tags,Date');
                    break;
                case 'sqlite3':
                    desc = t('SQLite3 format: A .sqlite or .db database file exported from this plugin');
                    break;
            }
            formatDescEl.createEl('p', { text: desc });
        };

        updateFormatDesc();

        // File input
        new Setting(contentEl)
            .setName(t('Select File'))
            .addButton(button => {
                const inputEl = contentEl.createEl('input', {
                    attr: {
                        type: 'file',
                        accept: this.getFileAccept()
                    }
                });

                inputEl.addEventListener('change', () => {
                    if (inputEl.files && inputEl.files.length > 0) {
                        this.file = inputEl.files[0];
                        button.setButtonText(inputEl.files[0].name);
                    }
                });

                return button
                    .setButtonText(t('Choose File'))
                    .onClick(() => inputEl.click());
            });

        // Import button
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(t('Import'))
                .setWarning()
                .setCta()
                .onClick(async () => {
                    if (!this.file) {
                        new Notice(t('Please select a file first'));
                        return;
                    }
                    await this.onSubmit(this.selectedFormat, this.file);
                    this.close();
                })
            )
            .addButton(button => button
                .setButtonText(t('Cancel'))
                .onClick(() => this.close()));
    }

    private getFileAccept(): string {
        switch (this.selectedFormat) {
            case 'json':
                return '.json,application/json';
            case 'csv':
                return '.csv,text/csv';
            case 'sqlite3':
                return '.sqlite,.db,application/x-sqlite3';
            default:
                return '*/*';
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export { OpenFileModal, WarningModal, InputModal, ImportFormatModal };