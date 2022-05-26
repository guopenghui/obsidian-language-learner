import { ItemView, WorkspaceLeaf, } from 'obsidian'
import LanguageLearner from '../plugin'
import { createApp, App } from 'vue'
import LearnPanel from './LearnPanel.vue'
import { t } from "../lang/helper"

export const LEARN_PANEL_VIEW: string = 'langr-learn-panel'

export class LearnPanelView extends ItemView {
    plugin: LanguageLearner
    vueapp: App

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf)
        this.plugin = plugin
    }
    getViewType(): string {
        return LEARN_PANEL_VIEW
    }
    getDisplayText(): string {
        return t("Learning New Words")
    }
    getIcon(): string {
        return "reading-glasses"
    }
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        const contentEl = container.createEl("div", {
            cls: "langr-learn"
        })
        this.vueapp = createApp(LearnPanel)
        this.vueapp.config.globalProperties.view = this
        this.vueapp.config.globalProperties.plugin = this.plugin
        this.vueapp.mount(contentEl)
    }
    async onClose() {
        this.vueapp.unmount()
    }

}