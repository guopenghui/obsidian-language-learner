import { ItemView, WorkspaceLeaf, } from 'obsidian'
import LanguageLearner from '../plugin'
import { createApp, App } from 'vue'
import SearchPanel from './SearchPanel.vue'
import { t } from "../lang/helper"

export const SEARCH_PANEL_VIEW: string = 'langr-panel'

export class SearchPanelView extends ItemView {
    plugin: LanguageLearner
    vueapp: App

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf)
        this.plugin = plugin
    }
    query(selection: string) {
        dispatchEvent(new CustomEvent('obsidian-langr-search', { detail: { selection } }))
    }
    getViewType(): string {
        return SEARCH_PANEL_VIEW
    }
    getDisplayText(): string {
        return t("Search Panel")
    }
    getIcon(): string {
        return "logo-crystal"
    }
    async onOpen(this: SearchPanelView) {
        const container = this.containerEl.children[1];
        container.empty();
        const contentEl = container.createEl("div", {
            cls: "langr-search"
        })

        this.vueapp = createApp(SearchPanel)
        this.vueapp.config.globalProperties.plugin = this.plugin
        this.vueapp.mount(contentEl)
    }
    async onClose() {
        this.vueapp.unmount()
    }

}