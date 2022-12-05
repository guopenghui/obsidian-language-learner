import { ItemView, WorkspaceLeaf, } from 'obsidian';
import LanguageLearner from '@/plugin';
import { t } from "@/lang/helper";
import { createApp, App } from 'vue';
import SearchPanel from './SearchPanel.vue';

export const SEARCH_ICON: string = "book";
export const SEARCH_PANEL_VIEW: string = 'langr-search-panel';

export class SearchPanelView extends ItemView {
    plugin: LanguageLearner;
    vueapp: App;

    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType(): string {
        return SEARCH_PANEL_VIEW;
    }
    getDisplayText(): string {
        return t("Search Panel");
    }
    getIcon(): string {
        return SEARCH_ICON;
    }
    async onOpen(this: SearchPanelView) {
        const container = this.containerEl.children[1];
        container.empty();
        // const contentEl = container.createEl("div", {
        //     cls: "langr-search"
        // })

        this.vueapp = createApp(SearchPanel);
        this.vueapp.config.globalProperties.plugin = this.plugin;
        this.vueapp.mount(container);
    }
    async onClose() {
        this.vueapp.unmount();
    }

}