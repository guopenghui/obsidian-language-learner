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
} from "@/storage/interface";
import WordDB from "./idb";
import Plugin from "@/plugin";
import StorageDrive, {Paginate, PaginateResult, SortParams} from "@/storage/drive";
import { ExpressionsTable } from "../types";

export class IndexedStorageDrive extends StorageDrive {
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
        const storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        const storedWords = (await this.idb.expressions
                .where("expression").anyOf(payload.words)
                .toArray()
        ).map(expr => {
            return {text: expr.expression, status: expr.status} as Word;
        });
        const ac = await createAutomaton([...storedPhrases.keys()]);
        const searchedPhrases = (await ac.search(payload.article)).map(match => {
            return {text: match[1], status: storedPhrases.get(match[1]), offset: match[0]} as Phrase;
        });

        return {words: storedWords, phrases: searchedPhrases};
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        const expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            return null;
        }

        const sentences = await this.idb.sentences
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
            connections: [],
            date: expr.date,
        };

    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(e => e.toLowerCase());

        const exprs = await this.idb.expressions
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
        const unixStamp = moment.utc(time).unix();
        const wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp)
            .toArray();

        const res: ReviewWord[] = [];
        for (const expr of wordsAfter) {
            const sentences = await this.idb.sentences
                .where("id").anyOf(expr.sentences)
                .toArray();

            for (const item of sentences) {
                res.push({
                    title: expr.expression,
                    expression: item.sentence.replace(expr.expression, `==${expr.expression}==`),
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

    async getAllExpressionSimple(
        ignores?: boolean,
        sort?: SortParams,
        search?: { [key: string]: any },
        paginate?: Paginate
    ): Promise<PaginateResult<ExpressionInfoSimple[]>> {
        const bottomStatus = ignores ? -1 : 0;
        const pageSize = paginate?.pageSize || 100;
        const page = paginate?.page || 0; // 0-based

        // 构建查询
        const collection = this.idb.expressions.where("status").above(bottomStatus);

        // 处理搜索条件
        if (search && Object.keys(search).length > 0) {
            // 模糊搜索需要在内存中过滤
            const allData = await collection.toArray();

            const filteredData = allData.filter(expr => {
                let match = true;

                if (search.expression) {
                    match = match && expr.expression.toLowerCase().includes(search.expression.toLowerCase());
                }
                if (search.meaning && match) {
                    match = match && expr.meaning.toLowerCase().includes(search.meaning.toLowerCase());
                }
                if (search.status !== undefined && match) {
                    match = match && expr.status === search.status;
                }
                if (search.t && match) {
                    match = match && expr.t === search.t;
                }

                return match;
            });

            // 处理排序
            if (sort && Object.keys(sort).length > 0) {
                const sortField = Object.keys(sort)[0];
                const sortOrder = sort[sortField] === 'asc' ? 1 : -1;

                filteredData.sort((a, b) => {
                    if (sortField === 'expression') {
                        return sortOrder * a.expression.localeCompare(b.expression);
                    } else if (sortField === 'meaning') {
                        return sortOrder * a.meaning.localeCompare(b.meaning);
                    } else if (sortField === 'status') {
                        return sortOrder * (a.status - b.status);
                    } else if (sortField === 'date') {
                        return sortOrder * (Number(a.date) - Number(b.date));
                    }
                    return 0;
                });
            }

            // 计算分页
            const total = filteredData.length;
            const offset = page * pageSize;
            const paginatedData = filteredData.slice(offset, offset + pageSize);

            const data = paginatedData.map(expr => ({
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.t,
                tags: expr.tags,
                note_num: expr.notes.length,
                sen_num: expr.sentences.length,
                date: expr.date,
            }));

            return {
                data,
                total,
                page: page + 1, // 返回 1-based
                pageSize
            };
        }

        // 没有搜索条件，使用数据库原生查询
        const totalCount = await collection.count();

        // 处理排序 - 使用 Dexie 的 offset/limit/toArray 后在内存中排序
        // 因为 Dexie 的 Collection 不支持动态排序，需要先获取数据再排序
        const pageData = await collection.toArray();

        // 处理排序
        if (sort && Object.keys(sort).length > 0) {
            const sortField = Object.keys(sort)[0];
            const sortOrder = sort[sortField] === 'asc' ? 1 : -1;

            pageData.sort((a, b) => {
                if (sortField === 'expression') {
                    return sortOrder * a.expression.localeCompare(b.expression);
                } else if (sortField === 'meaning') {
                    return sortOrder * a.meaning.localeCompare(b.meaning);
                } else if (sortField === 'status') {
                    return sortOrder * (a.status - b.status);
                } else if (sortField === 'date') {
                    return sortOrder * (Number(a.date) - Number(b.date));
                }
                return 0;
            });
        } else {
            // 默认按日期降序
            pageData.sort((a, b) => Number(b.date) - Number(a.date));
        }

        // 手动分页
        const offset = page * pageSize;
        const paginatedData = pageData.slice(offset, offset + pageSize);

        const data = paginatedData.map(expr => ({
            expression: expr.expression,
            status: expr.status,
            meaning: expr.meaning,
            t: expr.t,
            tags: expr.tags,
            note_num: expr.notes.length,
            sen_num: expr.sentences.length,
            date: expr.date,
        }));

        return {
            data,
            total: totalCount,
            page: page + 1, // 返回 1-based
            pageSize
        };
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        const stored = await this.idb.expressions
            .where("expression").equals(payload.expression)
            .first();

        const sentenceIds = new Set<number>();

        // 处理句子 - 先检查是否已存在（通过 expression 和 sentence 判断）
        for (const sen of payload.sentences) {
            // 尝试查找已存在的句子
            const existing = await this.idb.sentences
                .where("sentence").equals(sen.sentence)
                .and(s => s.expression === payload.expression)
                .first();

            if (existing) {
                // 更新已存在的句子
                await this.idb.sentences.update(existing._id as number, {
                    sentence: sen.sentence,
                    trans: sen.trans || '',
                    origin: sen.origin || '',
                    date: moment().unix(),
                });
                sentenceIds.add(existing._id as number);
            } else {
                // 添加新句子
                const newSen = {
                    expression: payload.expression,
                    sentence: sen.sentence,
                    trans: sen.trans || '',
                    origin: sen.origin || '',
                    date: moment().unix(),
                };
                const id = await this.idb.sentences.add(newSen);
                sentenceIds.add(id);
            }
        }

        // 删除不再需要的旧句子
        if (stored && stored.sentences && stored.sentences.length > 0) {
            const oldSentenceIds = stored.sentences as number[];
            const idsToDelete = oldSentenceIds.filter(id => !sentenceIds.has(id));

            if (idsToDelete.length > 0) {
                await this.idb.sentences
                    .where("_id")
                    .anyOf(idsToDelete)
                    .delete();
            }
        }

        const updatedWord = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            notes: payload.notes || [],
            sentences: [...sentenceIds.values()],
            tags: [...new Set<string>(payload.tags || [])],
            connections: payload.connections || [],
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
        const allTags = new Set<string>();
        await this.idb.expressions.each(expr => {
            for (const t of expr.tags) {
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
                } as ExpressionsTable;
            })
        );
        return;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        const stored = await this.idb.sentences.where("text").equals(text).first();
        return stored;
    }

    async getCount(): Promise<CountInfo> {
        const counts: { "WORD": number[], "PHRASE": number[]; } = {
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
        const spans: Span[] = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            const start = moment().subtract(6, "days").startOf("day");
            const from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        const res: WordCount[] = [];

        // 对每一天计算
        for (const span of spans) {
            // 当日
            const today = new Array(5).fill(0);
            await this.idb.expressions.filter(expr => {
                return expr.t == WordType.WORD &&
                    expr.date >= span.from &&
                    expr.date <= span.to;
            }).each(expr => {
                today[expr.status]++;
            });
            // 累计
            const accumulated = new Array(5).fill(0);
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

    async importDB(data: File, format: 'json' | 'csv' | 'sqlite3') {
        if (format === 'sqlite3') {
            // SQLite3 格式：暂不支持导入到 IndexedDB
            throw new Error('Importing SQLite3 database to IndexedDB is not supported. Please export your data from the source in JSON format instead.');
        } else if (format === 'json' || format === 'csv') {
            // JSON 或 CSV 格式：使用 Dexie 的导入功能（仅支持 IndexedDB 导出的 JSON 格式）
            if (format === 'csv') {
                throw new Error('Importing CSV to IndexedDB is not directly supported. Please use JSON format or switch to SQLite3 storage.');
            }

            // JSON 格式（IndexedDB 导出格式）
            await this.idb.delete();
            await this.idb.open();
            await importInto(this.idb, data, {
                acceptNameDiff: true
            });
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }
    }

    async exportDB() {
        const blob = await exportDB(this.idb);
        try {
            download(blob, `${this.idb.storageName}.json`, "application/json");
        } catch (e) {
            console.error("error exporting database");
        }
    }

    async destroyAll() {
        return this.idb.delete();
    }

    async removeExpression(expression: string): Promise<boolean> {
        // 首先获取 expression 对象以获取关联的 sentences IDs
        const expr = await this.idb.expressions
            .where("expression").equals(expression)
            .first();

        if (!expr) {
            return false;
        }

        // 删除关联的 sentences
        if (expr.sentences && expr.sentences.length > 0) {
            await this.idb.sentences
                .where("_id")
                .anyOf(expr.sentences as number[])
                .delete();
        }

        // 删除 expression
        const deletedCount = await this.idb.expressions
            .where("expression").equals(expression)
            .delete();

        return deletedCount > 0;
    }
}


