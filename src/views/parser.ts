import { unified, Processor } from "unified";
import retextEnglish from "retext-english";
import { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { modifyChildren } from "unist-util-modify-children";
import { visit } from "unist-util-visit";
import { toString } from "nlcst-to-string";

// import { getStoredWords } from "../db/web_db";
import { Phrase, Word } from "../db/interface"
import Plugin from "../plugin";

const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];
type AnyNode = Root | Content | Content[];

export class TextParser {
    // 记录短语位置
    phrases: Phrase[] = [];
    // 记录单词状态
    words: Map<string, Word> = new Map<string, Word>();
    pIdx: number = 0;
    plugin: Plugin;
    processor: Processor;

    constructor(plugin: Plugin) {
        this.plugin = plugin
        this.processor = unified()
            .use(retextEnglish)
            .use(this.addPhrases())
            .use(this.stringfy2HTML());
    }

    async parse(data: string) {
        let lines = data.split("\n")
        let articleStart = lines.indexOf("^^^article") + 1
        let articleEnd = lines.indexOf("^^^words")

        let article = lines.slice(articleStart, articleEnd).join("\n")

        let newHTML = await this.text2HTML(article.trim())
        return newHTML
    }


    async text2HTML(text: string) {
        this.pIdx = 0;
        this.words.clear();

        // 先解析文本获取词组，提供给ast构造PhraseNode
        this.phrases = (
            await this.plugin.db.getStoredWords({ article: text.toLowerCase(), words: [] })
        ).phrases;

        const ast = this.processor.parse(text);
        let wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            wordSet.add(toString(word).toLowerCase());
        });

        // ast解析出文本中的WordNode后，再查询这些word的status
        let stored = await this.plugin.db.getStoredWords({ article: "", words: [...wordSet] });

        stored.words.forEach((w) => this.words.set(w.text, w));

        let HTML = this.processor.stringify(ast) as any as string;
        return HTML;
    }

    // Plugin：在retextEnglish基础上，把AST上一些单词包裹成短语
    addPhrases() {
        let selfThis = this
        return function (option = {}) {
            const proto = this.Parser.prototype;
            proto.useFirst("tokenizeParagraph", selfThis.phraseModifier);
        }
    }

    phraseModifier = modifyChildren(this.wrapWord2Phrase.bind(this));

    wrapWord2Phrase(node: Content, index: number, parent: Parent) {
        if (!node.hasOwnProperty("children")) return;

        if (
            this.pIdx >= this.phrases.length ||
            node.position.end.offset <= this.phrases[this.pIdx].offset
        )
            return;

        let children = (node as Sentence).children;

        let p: number;
        while (
            (p = children.findIndex(
                (child) => child.position.start.offset === this.phrases[this.pIdx].offset
            )) !== -1
        ) {
            let q = children.findIndex(
                (child) =>
                    child.position.end.offset ===
                    this.phrases[this.pIdx].offset + this.phrases[this.pIdx].text.length
            );

            if (q === -1) {
                this.pIdx++;
                return;
            }
            let phrase = children.slice(p, q + 1);
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
        let selfThis = this
        return function () {
            Object.assign(this, { Compiler: selfThis.compileHTML.bind(selfThis) });
        }
    }

    compileHTML(tree: Root): string {
        return this.toHTMLString(tree);
    }



    toHTMLString(node: AnyNode): string {
        if (node.hasOwnProperty("value")) {
            return (node as Literal).value;
        }
        if (node.hasOwnProperty("children")) {
            let n = node as Parent;
            switch (n.type) {
                case "WordNode": {
                    let text = toString(n.children);
                    let status = this.words.has(text.toLowerCase())
                        ? STATUS_MAP[this.words.get(text.toLowerCase()).status]
                        : "new";
                    return /^[0-9]+$/.test(text)
                        ? `<span>${text}</span>`
                        : `<span class="word ${status}">${text}</span>`;
                }
                case "PhraseNode": {
                    //测试
                    let childText = toString(n.children);
                    let text = this.toHTMLString(n.children);
                    let phrase = this.phrases.find(
                        (p) => p.text === childText.toLowerCase()
                    );
                    let status = STATUS_MAP[phrase.status];
                    return `<span class="phrase ${status}">${text}</span>`;
                }
                case "SentenceNode": {
                    return `<span class="stns">${this.toHTMLString(n.children)}</span>`;
                }
                case "ParagraphNode": {
                    return `<p>${this.toHTMLString(n.children)}</p>`;
                }
                default: {
                    return `<div class="article">${this.toHTMLString(n.children)}</div>`;
                }
            }
        }
        if (Array.isArray(node)) {
            let nodes = node as Content[];
            return nodes.map((n) => this.toHTMLString(n)).join("");
        }
    }
}