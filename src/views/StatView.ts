import { ItemView, WorkspaceLeaf, } from 'obsidian';
import { createApp, App } from 'vue';

import MainPlugin from "@/plugin";
import { t } from "@/lang/helper";
import Stat from './Stat.vue';

export const STAT_ICON: string = "bar-chart-4";
export const STAT_VIEW_TYPE: string = 'langr-stat';

export class StatView extends ItemView {
    vueApp: App;
    plugin: MainPlugin;
    constructor(leaf: WorkspaceLeaf, plugin: MainPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType(): string {
        return STAT_VIEW_TYPE;
    }
    getDisplayText(): string {
        return t("Statistics");
    }
    getIcon(): string {
        return STAT_ICON;
    }
    async onOpen() {
        const container = this.containerEl.children[1]; // view-content
        let content = container.createDiv({ cls: "langr-stat" });

        this.vueApp = createApp(Stat);
        this.vueApp.config.globalProperties.container = content;
        this.vueApp.config.globalProperties.plugin = this.plugin;
        this.vueApp.mount(content);
    }
    async onClose() {
        this.vueApp.unmount();
    }
}