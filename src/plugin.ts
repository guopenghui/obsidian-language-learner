import {
	App,
	Modal,
	Notice,
	Plugin,
	Menu,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	ViewState,
	MarkdownView,
	Editor,
	TFile
} from 'obsidian';
import { createApp } from 'vue';
import { around } from 'monkey-around'

import LangrApp from './views/App.vue'
import { SearchPanelView, SEARCH_PANEL_VIEW } from './views/SearchPanelView'
import { READING_VIEW_TYPE, READING_ICON, ReadingView } from './views/ReadingView';
import { LearnPanelView, LEARN_PANEL_VIEW } from "./views/LearnPanelView"
import { StatView, STAT_VIEW_TYPE } from './views/StatView'

import { t } from "./lang/helper"
import { getExpressionSimple, option } from "./api"

export const FRONT_MATTER_KEY: string = 'langr'


interface MyPluginSettings {
	dataBase: string;
	port: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	dataBase: null,
	port: 8086,
}

export default class LanguageLearner extends Plugin {
	settings: MyPluginSettings;
	appEl: HTMLElement;

	async onload() {
		const pluginSelf = this

		await this.loadSettings();

		option.PORT = this.settings.port
		//注册测试视图
		this.registerView(
			STAT_VIEW_TYPE,
			(leaf) => new StatView(leaf, this)
		)

		// 注册查词面板视图		
		this.registerView(
			SEARCH_PANEL_VIEW,
			(leaf) => new SearchPanelView(leaf, this)
		)
		// 注册新词面板视图
		this.registerView(
			LEARN_PANEL_VIEW,
			(leaf) => new LearnPanelView(leaf, this)
		)
		// 注册阅读视图
		this.registerView(
			READING_VIEW_TYPE,
			(leaf) => new ReadingView(leaf, this)
		)

		this.addRibbonIcon('logo-crystal', t('Open word search panel'), (evt) => {
			this.activateView(SEARCH_PANEL_VIEW)
		})

		this.addRibbonIcon('reading-glasses', t('Open new word panel'), (evt) => {
			this.activateView(LEARN_PANEL_VIEW)
		})
		this.addRibbonIcon("paper-plane", t("Open statistics"), async (evt) => {
			this.activateView(STAT_VIEW_TYPE)
		})

		this.addSettingTab(new SettingTab(this.app, this))

		this.addCommand({
			id: "langr-refresh-database",
			name: t("Refresh Word Database"),
			callback: async () => {
				let dataBase = this.app.vault.getAbstractFileByPath(this.settings.dataBase)
				if (!dataBase || dataBase.hasOwnProperty("children")) {
					new Notice("Invalid database path")
					return
				}
				let db = dataBase as TFile
				let words = await getExpressionSimple(false)


				let classified: number[][] = Array(5).fill(0).map(_ => [])
				words.forEach((word, i) => {
					classified[word.status].push(i)
				})

				const statusMap = [t("Ignore"), t("Learning"), t("Familiar"), t("Known"), t("Learned")]
				let classified_texts = classified.map((w, idx) => {
					return `#### ${statusMap[idx]}\n`
						+ w.map(i => `${words[i].expression} , ${words[i].meaning}`).join("\n")
						+ "\n"
				})
				classified_texts.shift()
				let text = classified_texts.join("\n")

				this.app.vault.modify(db, text)
			}
		})


		// 在MardownView的扩展菜单加一个转为Reading模式的选项
		this.register(
			around(MarkdownView.prototype, {
				onMoreOptionsMenu(next) {
					return function (m: Menu) {
						const file = this.file
						const cache = file.cache
							? pluginSelf.app.metadataCache.getFileCache(file)
							: null

						if (!file || !cache?.frontmatter || !cache?.frontmatter[FRONT_MATTER_KEY]) {
							return next.call(this, m)
						}

						m.addItem((item) => {
							item
								.setTitle(t("Open as Reading View"))
								.setIcon(READING_ICON)
								.onClick(() => {
									pluginSelf.setReadingView(this.leaf)
								})
						})

						next.call(this, m)

					}
				}
			})
		)

		this.registerContextMenu()
		this.registerLeftClick()
		//this.mountApp()
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW)
	}

	mountApp() {
		createApp(LangrApp)
			.mount(this.appEl ?? (this.appEl = document.body.createDiv({ cls: "langr-app" })))
	}

	async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
		await leaf.setViewState(
			{
				type: "markdown",
				state: leaf.view.getState(),
				//popstate: true,
			} as ViewState,
			{ focus }
		)
	}
	async setReadingView(leaf: WorkspaceLeaf) {
		await leaf.setViewState(
			{
				type: READING_VIEW_TYPE,
				state: leaf.view.getState(),
				//popstate: true,
			} as ViewState,
		)
	}

	// 管理所有的右键菜单
	registerContextMenu() {
		let addMemu = (mu: Menu, selection: string) => {
			mu.addItem((item) => {
				item.setTitle(t("Search word"))
					.setIcon('info')
					.onClick(async () => {
						//new Notice("你好，开发者!")
						await this.activateView(SEARCH_PANEL_VIEW)
						const view = this.app.workspace.getLeavesOfType(SEARCH_PANEL_VIEW)[0].view as SearchPanelView
						view.query(selection)
					})
			})

		}
		// markdown 编辑模式 右键菜单
		this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
			let selection = editor.getSelection()
			if (selection || selection.trim().length === selection.length) {
				addMemu(menu, selection)
			}
		}))

		// markdown 预览模式 右键菜单
		this.registerDomEvent(document.body, "contextmenu", (evt) => {
			if ((evt as any).path.find((el: HTMLElement) => {
				return (el instanceof HTMLElement) && (el.hasClass('markdown-preview-view'))
			})) {
				const selection = window.getSelection().toString()
				if (!selection) return

				evt.preventDefault()
				let menu = new Menu(this.app)

				addMemu(menu, selection)

				menu.showAtMouseEvent(evt)
			}
			else if ((evt as any).path.find((el: HTMLElement) => {
				return el instanceof HTMLElement && el.hasClass("text-area")
			})) {
				const selection = window.getSelection()
				if (selection.rangeCount === 0) return

				evt.preventDefault()
				let range = selection.getRangeAt(0)
				if (range.collapsed) return

				range.setStart(range.startContainer.parentNode, 0)
				range.setEnd(range.endContainer.parentNode, 0)

				if (range.startContainer.parentNode !== range.endContainer.parentNode) return

				let start = range.startContainer
				let end = range.endContainer

				let parent = start.parentNode
				let newSpan = document.body.createSpan({ cls: "select" })
				parent.insertBefore(newSpan, start)

				let beginInsert = false
				let collection = [] as any[]
				parent.childNodes.forEach((item) => {
					if (item === newSpan) {
						beginInsert = true
						return
					}
					if (!beginInsert) return
					collection.push(item)
					if (item === end) {
						beginInsert = false
					}
				})
				collection.forEach((item) => {
					newSpan.appendChild(item)
				})


				//selection.collapseToStart()

			}
		})
	}

	registerLeftClick() {
		this.registerDomEvent(document.body, "click", (evt) => {
			let target = evt.target as HTMLElement
			if (target.classList.contains("word")) {
				// new Notice("单词: " + target.textContent)
				dispatchEvent(new CustomEvent("obsidian-langr-search", { detail: { selection: target.innerText, target } }))
			} else if (target.classList.contains("select")) {
				// new Notice("选择: " + target.textContent)
				dispatchEvent(new CustomEvent("obsidian-langr-search", { detail: { selection: target.innerText, target } }))
			} else if (target.classList.contains("phrase")) {
				// new Notice("短语: " + target.textContent)
				dispatchEvent(new CustomEvent("obsidian-langr-search", { detail: { selection: target.innerText, target } }))
			} else {
				if (target.classList.contains("text-area") && !target.classList.contains("stns")) {
					let selection = window.getSelection()
					selection.collapseToStart()

					// 消除select块
					let view = this.app.workspace.getActiveViewOfType(ReadingView)
					if (view) {
						view.removeSelect()
					}
				}
			}
		})
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	async activateView(VIEW_TYPE: string) {

		if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
			await this.app.workspace.getRightLeaf(false).setViewState({
				type: VIEW_TYPE,
				active: true,
			})
		}

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
		)
	}
}


class SettingTab extends PluginSettingTab {
	plugin: LanguageLearner;

	constructor(app: App, plugin: LanguageLearner) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;

		containerEl.empty()
		containerEl.createEl("h2", { text: "Settings for Language Learner" })

		new Setting(containerEl)
			.setName("Database Path")
			.setDesc("Choose a md file as word database for auto-completion")
			.addText(text => text
				.setValue(this.plugin.settings.dataBase)
				.onChange(async (path) => {
					this.plugin.settings.dataBase = path
					await this.plugin.saveSettings()
				})
			)

		new Setting(containerEl)
			.setName("Server Port")
			.setDesc('An integer between 1024-65535. It should be same as "PORT" variable in .env file of server')
			.addText(text => text
				.setValue(String(this.plugin.settings.port))
				.onChange(async (port) => {
					let p = Number(port)
					if (!isNaN(p) && p >= 1023 && p <= 65535) {
						this.plugin.settings.port = p
						option.PORT = p
						await this.plugin.saveSettings()
					} else {
						new Notice("Wrong port format")
					}
				})
			)
	}
}