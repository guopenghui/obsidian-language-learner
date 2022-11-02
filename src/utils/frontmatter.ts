import { App, TFile, parseYaml, stringifyYaml } from "obsidian"


export class FrontMatterManager {
    app: App

    constructor(app: App) {
        this.app = app;
        (app as any).FM = this
    }

    // 解析
    async loadFrontMatter(file: TFile): Promise<any> {
        let res = {} as { [K in string]: string }
        let text = await this.app.vault.read(file);

        let match = text.match(/^\n*---\n([\s\S]+)\n---/)
        if (match) {
            res = parseYaml(match[1])
        }

        return res
    }

    async storeFrontMatter(file: TFile, obj: any) {
        if (Object.keys(obj).length === 0) {
            return
        }

        let text = await this.app.vault.read(file);
        let match = text.match(/^\n*---\n([\s\S]+)\n---/)

        let newText = ""
        let newFront = stringifyYaml(obj)
        if (match) {
            newText = text.replace(/^\n*---\n([\s\S]+)\n---/, `---\n${newFront}\n---`)
        } else {
            newText = `---\n${newFront}\n---\n\n` + text
        }

        this.app.vault.modify(file, newText)
    }

    // 读取值
    async getFrontMatter(file: TFile, key: string): Promise<string> {
        let frontmatter = await this.loadFrontMatter(file)

        return frontmatter[key]
    }

    // 修改
    async setFrontMatter(file: TFile, key: string, value: string) {
        let obj = await this.loadFrontMatter(file)

        obj[key] = value

        this.storeFrontMatter(file, obj)
    }
}