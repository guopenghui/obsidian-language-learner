import { App, TFile } from "obsidian"


export class FrontMatterManager {
    app: App

    constructor(app: App) {
        this.app = app
    }

    // 解析
    async loadFrontMatter(file: TFile): Promise<any> {
        const pt = /^\n*---\n([\s\S]+)\n---/

        let res = {} as any
        let text = await this.app.vault.read(file);


        ((text.match(pt) || [])[1] || "").split("\n").forEach((e) => {
            let match = e.match(/^([^:]+):\s+(.+)/)
            if (match && match[1] && match[2])
                res[`${match[1].trim()}`] = match[2].trim()
        })

        return res
    }

    async storeFrontMatter(file: TFile, obj: any) {
        if (Object.keys(obj).length === 0) {
            return
        }
        let text = await this.app.vault.read(file);
        let match = text.match(/^\n*---\n([\s\S]+)\n---/)

        let newText = ""
        let newFront = Object.keys(obj).map((k) => `${k}: ${obj[k]}`).join("\n")
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