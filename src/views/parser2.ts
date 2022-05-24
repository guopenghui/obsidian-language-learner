import { unified } from "unified";
import retextEnglish from "retext-english";
import { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { modifyChildren } from "unist-util-modify-children";
import { visit } from "unist-util-visit";
import { toString } from "nlcst-to-string";

import { getStoredWords, Phrase, Word } from "../api";

const processor = unified()
    .use(retextEnglish)
    .use(addPhrases)
    .use(stringfy2HTML);

// 记录短语位置
let phrases: Phrase[] = [];
// 记录单词状态
let words = new Map<string, Word>();

let pIdx = 0;
export async function text2HTML(text: string) {
    pIdx = 0;
    words.clear();

    // 先解析文本获取词组，提供给ast构造PhraseNode
    phrases = await (
        await getStoredWords({ article: text.toLowerCase(), words: [] })
    ).phrases;
    const ast = processor.parse(text);

    let wordSet: Set<string> = new Set();
    visit(ast, "WordNode", (word) => {
        wordSet.add(toString(word).toLowerCase());
    });

    // ast解析出文本中的WordNode后，再查询这些word的status
    let stored = await getStoredWords({ article: "", words: [...wordSet] });

    stored.words.forEach((w) => words.set(w.text, w));

    let HTML = processor.stringify(ast) as any as string;
    return HTML;
}

// Plugin：在retextEnglish基础上，把AST上一些单词包裹成短语
function addPhrases(option = {}) {
    const proto = this.Parser.prototype;
    proto.useFirst("tokenizeParagraph", phraseModifier);
}

const phraseModifier = modifyChildren(wrapWord2Phrase);

function wrapWord2Phrase(node: Content, index: number, parent: Parent) {
    if (!node.hasOwnProperty("children")) return;

    if (
        pIdx >= phrases.length ||
        node.position.end.offset <= phrases[pIdx].offset
    )
        return;

    let children = (node as Sentence).children;

    let p: number;
    while (
        (p = children.findIndex(
            (child) => child.position.start.offset === phrases[pIdx].offset
        )) !== -1
    ) {
        let q = children.findIndex(
            (child) =>
                child.position.end.offset ===
                phrases[pIdx].offset + phrases[pIdx].text.length
        );

        if (q === -1) {
            pIdx++;
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

        pIdx++;

        if (
            pIdx >= phrases.length ||
            node.position.end.offset <= phrases[pIdx].offset
        )
            return;
    }
}

// Compiler部分: 在AST转换为string时包裹上相应标签
function stringfy2HTML() {
    Object.assign(this, { Compiler: compileHTML });
}

function compileHTML(tree: Root): string {
    return toHTMLString(tree);
}

type AnyNode = Root | Content | Content[];

const statusMap = ["ignore", "learning", "familiar", "known", "learned"];

function toHTMLString(node: AnyNode): string {
    if (node.hasOwnProperty("value")) {
        return (node as Literal).value;
    }
    if (node.hasOwnProperty("children")) {
        let n = node as Parent;
        switch (n.type) {
            case "WordNode": {
                let text = toString(n.children);
                let status = words.has(text.toLowerCase())
                    ? statusMap[words.get(text.toLowerCase()).status]
                    : "new";
                return /^[0-9]+$/.test(text)
                    ? `<span>${text}</span>`
                    : `<span class="word ${status}">${text}</span>`;
            }
            case "PhraseNode": {
                //测试
                let childText = toString(n.children);
                let text = toHTMLString(n.children);
                let phrase = phrases.find(
                    (p) => p.text === childText.toLowerCase()
                );
                let status = statusMap[phrase.status];
                return `<span class="phrase ${status}">${text}</span>`;
            }
            case "SentenceNode": {
                return `<span class="stns">${toHTMLString(n.children)}</span>`;
            }
            case "ParagraphNode": {
                return `<p>${toHTMLString(n.children)}</p>`;
            }
            default: {
                return `<div class="article">${toHTMLString(n.children)}</div>`;
            }
        }
    }
    if (Array.isArray(node)) {
        let nodes = node as Content[];
        return nodes.map((n) => toHTMLString(n)).join("");
    }
}
