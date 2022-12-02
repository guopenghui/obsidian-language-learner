import { App, TFile, parseYaml, stringifyYaml } from "obsidian";

type FrontMatter = { [K in string]: string };

export class FrontMatterManager {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    // 解析
    async loadFrontMatter(file: TFile): Promise<FrontMatter> {
        let res = {} as FrontMatter;
        let text = await this.app.vault.read(file);

        let match = text.match(/^\n*---\n([\s\S]+)\n---/);
        if (match) {
            res = parseYaml(match[1]);
        }

        return res;
    }

    async storeFrontMatter(file: TFile, fm: FrontMatter) {
        if (Object.keys(fm).length === 0) {
            return;
        }

        let text = await this.app.vault.read(file);
        let match = text.match(/^\n*---\n([\s\S]+)\n---/);

        let newText = "";
        let newFront = stringifyYaml(fm);
        if (match) {
            newText = text.replace(/^\n*---\n([\s\S]+)\n---/, `---\n${newFront}---`);
        } else {
            newText = `---\n${newFront}---\n\n` + text;
        }

        this.app.vault.modify(file, newText);
    }

    // 读取值
    async getFrontMatter(file: TFile, key: string): Promise<string> {
        let frontmatter = await this.loadFrontMatter(file);

        return frontmatter[key];
    }

    // 修改
    async setFrontMatter(file: TFile, key: string, value: string) {
        let fm = await this.loadFrontMatter(file);

        fm[key] = value;

        this.storeFrontMatter(file, fm);
    }
}