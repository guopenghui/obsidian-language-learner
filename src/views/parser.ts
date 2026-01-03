import { unified, Processor } from "unified";
import retextEnglish from "retext-english";
import { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { modifyChildren } from "unist-util-modify-children";
import { visit } from "unist-util-visit";
import { toString } from "nlcst-to-string";

import { Phrase, Word } from "@/storage/interface";
import Plugin from "@/plugin";

const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];
type AnyNode = Root | Content | Content[];

export class TextParser {
    // 记录短语位置
    phrases: Phrase[] = [];
    // 记录单词状态
    words: Map<string, Word> = new Map<string, Word>();
    pIdx = 0;
    plugin: Plugin;
    processor: Processor;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.processor = unified()
            .use(retextEnglish)
            .use(this.addPhrases())
            .use(this.stringfy2HTML());
    }

    async parse(data: string) {
        const newHTML = await this.text2HTML(data.trim());
        return newHTML;
    }

    async countWords(text: string): Promise<[number, number, number]> {
        const ast = this.processor.parse(text);
        const wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            const text = toString(word).toLowerCase();
            if (/[0-9\u4e00-\u9fa5]/.test(text)) return;
            wordSet.add(text);
        });
        const stored = await this.plugin.storage.DB().getStoredWords({
            article: "",
            words: [...wordSet],
        });
        let ignore = 0;
        stored.words.forEach((word) => {
            if (word.status === 0) ignore++;
        });
        const learn = stored.words.length - ignore;
        const unknown = wordSet.size - stored.words.length;

        return [unknown, learn, ignore];
    }

    async text2HTML(text: string) {
        this.pIdx = 0;
        this.words.clear();

        // 查找文本中的已知词组，用于构造ast中的PhraseNode
        this.phrases = (
            await this.plugin.storage.DB().getStoredWords({
                article: text.toLowerCase(),
                words: [],
            })
        ).phrases;

        const ast = this.processor.parse(text);

        // 获得文章中去重后的单词
        const wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            wordSet.add(toString(word).toLowerCase());
        });

        // 查询这些单词的status
        const stored = await this.plugin.storage.DB().getStoredWords({
            article: "",
            words: [...wordSet],
        });

        stored.words.forEach((w) => this.words.set(w.text, w));

        const HTML = this.processor.stringify(ast) as any as string;
        return HTML;
    }

    async getWordsPhrases(text: string) {
        const ast = this.processor.parse(text);
        const words: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            words.add(toString(word).toLowerCase());
        });
        const wordsPhrases = await this.plugin.storage.DB().getStoredWords({
            article: text.toLowerCase(),
            words: [...words],
        });

        const payload = [] as string[];
        wordsPhrases.phrases.forEach((word) => {
            if (word.status > 0) payload.push(word.text);
        });
        wordsPhrases.words.forEach((word) => {
            if (word.status > 0) payload.push(word.text);
        });

        const res = await this.plugin.storage.DB().getExpressionsSimple(payload);
        return res;
    }

    // Plugin：在retextEnglish基础上，把AST上一些单词包裹成短语
    addPhrases() {
        const selfThis = this;
        return function (this: any, options = {}) {
            // 使用 AST 转换器而不是修改 Parser
            return (tree: Root, file: any, next: any) => {
                try {
                    // 应用短语修饰符到整个树
                    const modified = selfThis.phraseModifier(tree);
                    next(null, modified);
                } catch (err) {
                    next(err);
                }
            };
        };
    }

    phraseModifier = modifyChildren(this.wrapWord2Phrase.bind(this));

    wrapWord2Phrase(node: Content, index: number, parent: Parent) {
        if (!node.hasOwnProperty("children")) return;

        if (
            this.pIdx >= this.phrases.length ||
            node.position.end.offset <= this.phrases[this.pIdx].offset
        )
            return;

        const children = (node as Sentence).children;

        let p: number;
        while (
            (p = children.findIndex(
                (child: any) =>
                    child.position.start.offset ===
                    this.phrases[this.pIdx].offset
            )) !== -1
        ) {
            const q = children.findIndex(
                (child: any) =>
                    child.position.end.offset ===
                    this.phrases[this.pIdx].offset +
                    this.phrases[this.pIdx].text.length
            );

            if (q === -1) {
                this.pIdx++;
                return;
            }
            const phrase = children.slice(p, q + 1);
            children.splice(p, q - p + 1, {
                type: "PhraseNode",
                children: phrase,
                position: {
                    start: { ...phrase.first().position.start },
                    end: { ...phrase.last().position.end },
                },
            } as any);

            this.pIdx++;

            if (
                this.pIdx >= this.phrases.length ||
                node.position.end.offset <= this.phrases[this.pIdx].offset
            )
                return;
        }
    }

    // Compiler部分: 在AST转换为string时包裹上相应标签
    stringfy2HTML() {
        const selfThis = this;
        return function () {
            Object.assign(this, {
                Compiler: selfThis.compileHTML.bind(selfThis),
            });
        };
    }

    compileHTML(tree: Root): string {
        return this.toHTMLString(tree);
    }

    toHTMLString(node: AnyNode): string {
        if (node.hasOwnProperty("value")) {
            return (node as Literal).value;
        }
        if (node.hasOwnProperty("children")) {
            const n = node as Parent;
            switch (n.type) {
                case "WordNode": {
                    const text = toString(n.children);
                    const textLower = text.toLowerCase();
                    const status = this.words.has(textLower)
                        ? STATUS_MAP[this.words.get(textLower).status]
                        : "new";

                    return /[0-9\u4e00-\u9fa5]/.test(text) // 不把数字当做单词
                        ? `<span class="other">${text}</span>`
                        : `<span class="word ${status}">${text}</span>`;
                }
                case "PhraseNode": {
                    const childText = toString(n.children);
                    const text = this.toHTMLString(n.children);
                    // 获取词组的status
                    const phrase = this.phrases.find(
                        (p) => p.text === childText.toLowerCase()
                    );
                    const status = STATUS_MAP[phrase.status];

                    return `<span class="phrase ${status}">${text}</span>`;
                }
                case "SentenceNode": {
                    return `<span class="stns">${this.toHTMLString(
                        n.children
                    )}</span>`;
                }
                case "ParagraphNode": {
                    return `<p>${this.toHTMLString(n.children)}</p>`;
                }
                default: {
                    return `<div class="article">${this.toHTMLString(
                        n.children
                    )}</div>`;
                }
            }
        }
        if (Array.isArray(node)) {
            const nodes = node as Content[];
            return nodes.map((n) => this.toHTMLString(n)).join("");
        }
    }
}
