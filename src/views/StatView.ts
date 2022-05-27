import { ItemView, WorkspaceLeaf, } from 'obsidian'
import { createApp, App } from 'vue'

import MainPlugin from "../plugin"
import Stat from './Stat.vue'
import { t } from "../lang/helper"

export const STAT_VIEW_TYPE: string = 'langr-stat'

export class StatView extends ItemView {
    vueApp: App
    plugin: MainPlugin
    constructor(leaf: WorkspaceLeaf, plugin: MainPlugin) {
        super(leaf)
        this.plugin = plugin
    }
    getViewType(): string {
        return STAT_VIEW_TYPE
    }
    getDisplayText(): string {
        return t("Statistics")
    }
    getIcon(): string {
        return "paper-plane"
    }
    async onOpen() {
        const container = this.containerEl.children[1] // view-content
        let content = container.createDiv({ cls: "langr-test" })

        this.vueApp = createApp(Stat)
        this.vueApp.config.globalProperties.container = content
        this.vueApp.config.globalProperties.plugin = this.plugin
        this.vueApp.mount(content)
    }
    async onClose() {
        this.vueApp.unmount()
    }
}