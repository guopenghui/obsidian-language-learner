import {moment} from "obsidian";
import {createAutomaton} from "ac-auto";
import {exportDB, importInto} from "dexie-export-import";
import download from "downloadjs";

import {
    ArticleWords,
    CountInfo,
    ExpressionInfo,
    ExpressionInfoSimple,
    Phrase, ReviewWord,
    Sentence,
    Span,
    Word,
    WordCount,
    WordsPhrase,
    WordType
} from "@/db/interface";
import DbProvider from "../../base";
import WordDB from "./idb";
import Plugin from "@/plugin";
import Dexie from "dexie";
import * as console from "console";

export class IndexedDB extends DbProvider {
    idb: WordDB;
    plugin: Plugin;

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }

    async open() {
        await this.idb.open();
        return;
    }

    close() {
        this.idb.close();
    }

    // 寻找页面中已经记录过的单词和词组
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        let storedWords = (await this.idb.expressions
                .where("expression").anyOf(payload.words)
                .toArray()
        ).map(expr => {
            return {text: expr.expression, status: expr.status} as Word;
        });

        let ac = await createAutomaton([...storedPhrases.keys()]);
        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return {text: match[1], status: storedPhrases.get(match[1]), offset: match[0]} as Phrase;
        });

        return {words: storedWords, phrases: searchedPhrases};
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        let expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            return null;
        }

        let sentences = await this.idb.sentences
            .where("id").anyOf(expr.sentences)
            .toArray();

        return {
            expression: expr.expression,
            meaning: expr.meaning,
            status: expr.status,
            t: expr.t,
            notes: expr.notes as string[],
            sentences,
            tags: expr.tags,
        };

    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(e => e.toLowerCase());

        let exprs = await this.idb.expressions
            .where("expression")
            .anyOf(expressions)
            .toArray();

        return exprs.map(v => {
            return {
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.t,
                tags: v.tags,
                sen_num: v.sentences.length,
                note_num: v.notes.length,
                date: v.date
            };
        });
    }

    async getExpressionAfter(time: string): Promise<ReviewWord[]> {
        let unixStamp = moment.utc(time).unix();
        let wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp)
            .toArray();

        let res: ReviewWord[] = [];
        for (let expr of wordsAfter) {
            let sentences = await this.idb.sentences
                .where("id").anyOf(expr.sentences)
                .toArray();

            for (let item of sentences) {
                res.push({
                    title: expr.expression,
                    expression: item.text.replace(expr.expression, `==${expr.expression}==`),
                    meaning: item.trans,
                    status: expr.status,
                    t: WordType.PHRASE,
                    notes: [],
                    sentences: [],
                    tags: expr.tags,
                });
            }

            res.push({
                title: expr.expression,
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes as string[],
                sentences,
                tags: expr.tags,
            });
        }
        return res;
    }

    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        let exprs: ExpressionInfoSimple[];
        let bottomStatus = ignores ? -1 : 0;
        exprs = (await this.idb.expressions
                .where("status").above(bottomStatus)
                .toArray()
        ).map((expr): ExpressionInfoSimple => {
            return {
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.t,
                tags: expr.tags,
                note_num: expr.notes.length,
                sen_num: expr.sentences.length,
                date: expr.date,
            };
        });
        console.log(exprs, 111)

        return exprs;
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        let stored = await this.idb.expressions
            .where("expression").equals(payload.expression)
            .first();

        let sentences = new Set<number>();
        for (let sen of payload.sentences) {
            let searched = await this.idb.sentences.where("text").equals(sen.text).first();
            if (searched) {
                await this.idb.sentences.update(searched._id as number, sen);
                sentences.add(searched._id as number);
            } else {
                let id = await this.idb.sentences.add(sen);
                sentences.add(id);
            }
        }

        let updatedWord = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            notes: payload.notes,
            sentences: [...sentences.values()],
            tags: [...(new Set<string>(payload.tags).values())],
            connections: [] as string[],
            date: moment().unix(),
        };

        if (stored) {
            await this.idb.expressions.update(stored._id as number, updatedWord);
        } else {
            await this.idb.expressions.add(updatedWord);
        }

        return 200;
    }

    async getTags(): Promise<string[]> {
        let allTags = new Set<string>();
        await this.idb.expressions.each(expr => {
            for (let t of expr.tags) {
                allTags.add(t);
            }
        });

        return [...allTags.values()];
    }

    async postIgnoreWords(payload: string[]): Promise<void> {

        await this.idb.expressions.bulkPut(
            payload.map(expr => {
                return {
                    expression: expr,
                    meaning: "",
                    status: 0,
                    t: WordType.WORD,
                    notes: [],
                    sentences: [],
                    tags: [],
                    connections: [],
                    date: moment().unix()
                };
            })
        );
        return;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        let stored = await this.idb.sentences.where("text").equals(text).first();
        return stored;
    }

    async getCount(): Promise<CountInfo> {
        let counts: { "WORD": number[], "PHRASE": number[]; } = {
            "WORD": new Array(5).fill(0),
            "PHRASE": new Array(5).fill(0),
        };
        await this.idb.expressions.each(expr => {
            counts[expr.t as WordType][expr.status]++;
        });

        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE
        };
    }

    async countSeven(): Promise<WordCount[]> {
        let spans: Span[] = [];
        spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let start = moment().subtract(6, "days").startOf("day");
            let from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        let res: WordCount[] = [];

        // 对每一天计算
        for (let span of spans) {
            // 当日
            let today = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == WordType.WORD &&
                    expr.date >= span.from &&
                    expr.date <= span.to;
            }).each(expr => {
                today[expr.status]++;
            });
            // 累计
            let accumulated = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == WordType.WORD &&
                    expr.date <= span.to;
            }).each(expr => {
                accumulated[expr.status]++;
            });

            res.push({today, accumulated});
        }

        return res;
    }

    async importDB(file: File) {
        await this.idb.delete();
        await this.idb.open();
        await importInto(this.idb, file, {
            acceptNameDiff: true
        });
    }

    async exportDB() {
        let blob = await exportDB(this.idb);
        try {
            download(blob, `${this.idb.dbName}.json`, "application/json");
        } catch (e) {
            console.error("error exporting database");
        }
    }

    async destroyAll() {
        return this.idb.delete();
    }

    async removeExpression(expression: string): Promise<boolean> {
        const state = await this.idb.expressions
            .where("expression").equals(expression).delete();

        return state > 0
    }
}


