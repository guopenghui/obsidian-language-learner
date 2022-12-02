import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App } from "vue";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";
import DataPanel from "./DataPanel.vue";

export const DATA_ICON: string = "database";
export const DATA_PANEL_VIEW: string = "langr-data-panel";

export class DataPanelView extends ItemView {
	plugin: PluginType;
	vueapp: App;

	constructor(leaf: WorkspaceLeaf, plugin: PluginType) {
		super(leaf);
		this.plugin = plugin;
	}
	getViewType(): string {
		return DATA_PANEL_VIEW;
	}
	getDisplayText(): string {
		return t("Data Panel");
	}
	getIcon(): string {
		return DATA_ICON;
	}
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		// const contentEl = container.createEl("div", {
		//     cls: "langr-search"
		// })

		this.vueapp = createApp(DataPanel);
		this.vueapp.config.globalProperties.plugin = this.plugin;
		this.vueapp.mount(container);
	}
	async onClose() {
		this.vueapp.unmount();
		this.vueapp = null;
	}
}
