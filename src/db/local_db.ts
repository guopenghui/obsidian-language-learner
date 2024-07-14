import { moment } from "obsidian";
import { createAutomaton, Automaton } from "ac-auto";
import { exportDB, importInto } from "dexie-export-import";
import download from "downloadjs";

import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span
} from "./interface";
import DbProvider from "./base";
import {WordDB,Expression} from "./idb";
import Plugin from "@/plugin";


export class LocalDb extends DbProvider {
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
        //查询存储的短语
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        //查询存储的单词
        // let storedWords = (await this.idb.expressions
        //     .where("expression").anyOf(payload.words)
        //     .toArray()
        // ).map(expr => {
        //     return { text: expr.expression, status: expr.status } as Word;
        // });
        // 查询 "expression" 字段中包含在 payload.words 中的记录
        let storedWordsExpression = await this.idb.expressions
        .where("expression").anyOf(payload.words)
        .toArray();

        // 查询aliases中 payload.words 中的英文单词的记录
        let storedWordsMeaning = await this.idb.expressions
            .toArray()
            .then(expressions => {
                return expressions
                    .filter(expr => {
                        if(expr.aliases.length > 0){
                            return expr.aliases.some(word => payload.words.includes(word));
                        }else{
                            return;
                        }
                    })
                    .flatMap(expr => {
                        //let meanings = extractEnglishWords(expr.meaning);
                        return expr.aliases.map(word => ({
                            expression: word,  // 更新 expression 字段为匹配的英文单词
                            status: expr.status
                        }));
                    });
            });
        // 合并并去重
        let mergedResults = [...storedWordsExpression, ...storedWordsMeaning];

        // 转换为 Word 类型数组
        let storedWords = mergedResults.map(expr => ({
        text: expr.expression,
        status: expr.status
        }) as Word);
        // // 解析 "meaning" 字段中的英文单词
        // function extractEnglishWords(meaningString: string): string[] {
        // let words: string[] = [];
        // let matches = meaningString.match(/\((.*?)\)/);
        // if (matches) {
        //     words = matches[1].split(',').map(w => w.trim());
        // }
        // return words;
        // }

        // function ty(con:string) {
        //     console.log(con);
        //   }


        //对文章进行搜索，找到匹配的表达式，并将结果映射为 { text, status, offset } 形式的 Phrase 对象数组，其中 offset 是匹配的起始位置。
        let ac = await createAutomaton([...storedPhrases.keys()]);
        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        let expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            expr = await this.idb.expressions
            .filter(item => item.aliases.includes(expression)).first();
            if(!expr){return null;}
        }

        let sentences = await this.idb.sentences
            .where("id").anyOf([...expr.sentences.values()])
            .toArray();

        return {
            expression: expr.expression,
            meaning: expr.meaning,
            status: expr.status,
            t: expr.t,
            notes: expr.notes,
            sentences,
            tags: [...expr.tags.keys()],
            aliases:expr.aliases,
            date: expr.date,
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
                tags: [...v.tags.keys()],
                sen_num: v.sentences.size,
                note_num: v.notes.length,
                date: v.date,
                aliases: v.aliases,
            };
        });
    }

    async getExprall(expressions: string[]): Promise<ExpressionInfo[]> {
        expressions = expressions.map(expression => expression.toLowerCase());

        // 查询所有表达式的 expressions 和 aliases
        let exprMap = new Map<string, Expression>();
        let aliasesMap = new Map<string, Expression>();

        // const promises = [
        //     this.idb.expressions.where("expression").anyOf(expressions).each(expr => {
        //         exprMap.set(expr.expression.toLowerCase(), expr);
        //     })
        // ];
        // // 检查是否有别名
        // const hasAliases = await this.idb.expressions.filter(item => item.aliases && item.aliases.length > 0).count();

        // if (hasAliases > 0) {
        //     promises.push(
        //         this.idb.expressions.filter(item => item.aliases.some(alias => expressions.includes(alias))).each(expr => {
        //             expr.aliases.forEach(alias => {
        //                 aliasesMap.set(alias.toLowerCase(), expr);
        //             });
        //         })
        //     );
        // }

        // // 等待所有 Promise 完成
        // await Promise.all(promises);
        //         await Promise.all([
        //             this.idb.expressions.where("expression").anyOf(expressions).each(expr => {
        //                 exprMap.set(expr.expression.toLowerCase(), expr);
        //             }),
        //             this.idb.expressions.filter(item => item.aliases.some(alias => expressions.includes(alias))).each(expr => {
        //                 expr.aliases.forEach(alias => {
        //                     aliasesMap.set(alias.toLowerCase(), expr);
        //                 });
        //             })
        //         ]);
        await Promise.all([
            this.idb.expressions.where("expression").anyOf(expressions).each(expr => {
                exprMap.set(expr.expression.toLowerCase(), expr);
            }),
            this.idb.expressions.filter(item => item.aliases && item.aliases.length > 0 && item.aliases.some(alias => expressions.includes(alias))).each(expr => {
                expr.aliases.forEach(alias => {
                    aliasesMap.set(alias.toLowerCase(), expr);
                });
            })
        ]);
        // 组装结果
        let expressionInfos: ExpressionInfo[] = [];

        for (let expression of expressions) {
            let expr = exprMap.get(expression);
            if (!expr) {
                expr = aliasesMap.get(expression);
            }

            if (!expr) {
                expressionInfos.push(null); // 如果没有找到匹配项，添加 null 到结果数组
                continue; // 继续下一个表达式的处理
            }

            let sentences = await this.idb.sentences
                .where("id").anyOf([...expr.sentences.values()])
                .toArray();

            expressionInfos.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags],
                aliases: expr.aliases,
                date: expr.date,
            });
        }

        return expressionInfos;
    }



    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp)
            .toArray();

        let res: ExpressionInfo[] = [];
        for (let expr of wordsAfter) {
            let sentences = await this.idb.sentences
                .where("id").anyOf([...expr.sentences.values()])
                .toArray();

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags.keys()],
                aliases: expr.aliases,
                date: expr.date,
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
                tags: [...expr.tags.keys()],
                note_num: expr.notes.length,
                sen_num: expr.sentences.size,
                date: expr.date,
                aliases:expr.aliases,
            };
        });

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
                await this.idb.sentences.update(searched.id, sen);
                sentences.add(searched.id);
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
            sentences,
            tags: new Set<string>(payload.tags),
            aliases: payload.aliases,
            date: moment().unix()
        };
        if (stored) {
            await this.idb.expressions.update(stored.id, updatedWord);
        } else {
            await this.idb.expressions.add(updatedWord);
        }

        return 200;
    }

    async getTags(): Promise<string[]> {
        let allTags = new Set<string>();
        await this.idb.expressions.each(expr => {
            for (let t of expr.tags.values()) {
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
                    t: "WORD",
                    notes: [],
                    sentences: new Set(),
                    tags: new Set(),
                    aliases: [],
                    date: moment().unix(),
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
            counts[expr.t as "WORD" | "PHRASE"][expr.status]++;
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
                return expr.t == "WORD" &&
                    expr.date >= span.from &&
                    expr.date <= span.to;
            }).each(expr => {
                today[expr.status]++;
            });
            // 累计
            let accumulated = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == "WORD" &&
                    expr.date <= span.to;
            }).each(expr => {
                accumulated[expr.status]++;
            });

            res.push({ today, accumulated });
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
}


