import { ItemView, WorkspaceLeaf, } from 'obsidian';
import LanguageLearner from '@/plugin';
import { t } from "@/lang/helper";
import { createApp, App } from 'vue';
import LearnPanel from './LearnPanel.vue';

export const LEARN_ICON: string = "reading-glasses";
export const LEARN_PANEL_VIEW: string = 'langr-learn-panel';

export class LearnPanelView extends ItemView {
    plugin: LanguageLearner;
    vueapp: App;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType(): string {
        return LEARN_PANEL_VIEW;
    }
    getDisplayText(): string {
        return t("Learning New Words");
    }
    getIcon(): string {
        return LEARN_ICON;
    }
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        // const contentEl = container.createEl("div", {
        //     cls: "langr-learn"
        // })
        this.vueapp = createApp(LearnPanel);
        this.vueapp.config.globalProperties.view = this;
        this.vueapp.config.globalProperties.plugin = this.plugin;
        this.vueapp.mount(container);
    }
    async onClose() {
        this.vueapp.unmount();
    }

}