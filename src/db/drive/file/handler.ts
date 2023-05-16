import {
    ArticleWords,
    CountInfo,
    ExpressionInfo,
    ExpressionInfoSimple,
    Phrase,
    Sentence,
    Span,
    Word,
    WordCount,
    WordType,
    WordsPhrase
} from "@/db/interface";
import Plugin from '@/plugin';
import { createAutomaton, Automaton } from "ac-auto";
import { ElectronStorage } from '@qiyangxy/tedb-electron-storage';
import { moment, Notice } from 'obsidian';
import path from 'path';
import * as tedb from "tedb";
import DbProvider from '../../base';
import { ExpressionsTable, NotesTable, SentencesTable, Tables } from '../types';
import exp from "constants";

export default class FileDB extends DbProvider {
    plugin: Plugin;
    dbName: string;
    dbPath: string;
    dbDir: string;
    basePath: string;

    private tables: Map<string, tedb.Datastore> = new Map();

    // db: Database = null

    constructor(plugin: Plugin) {
        super();
        // todo 待优化不确定目前是否有更好的获取当前根目录方法
        this.basePath = app.vault.adapter.getBasePath();

        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        this.dbDir = plugin.settings.db_dir;
        this.dbPath = path.join(this.basePath, this.dbDir);
        console.log(this.dbPath, 'path')
    }

    init() {
        this.tables
            .set(Tables.EXPRESSION, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.EXPRESSION, this.dbPath) }))
            .set(Tables.SENTENCE, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.SENTENCE, this.dbPath) }))
            .set(Tables.CONNECTIONS, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.CONNECTIONS, this.dbPath) }))
            .set(Tables.NOTES, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.NOTES, this.dbPath) }))

        this.initIndex();
    }

    async initIndex() {
        // this.tables.get(Tables.EXPRESSION).ensureIndex(
        //     { fieldName: "expression", unique: true },
        // )

        // this.tables.get(Tables.SENTENCE).ensureIndex(
        //     { fieldName: "eid", unique: false },
        // )
        // this.tables.get(Tables.NOTES).ensureIndex(
        //     { fieldName: "eid", unique: false },
        // )

        // this.tables.get(Tables.CONNECTIONS).ensureIndex(
        //     { fieldName: "eid", unique: false },
        // )
    }

    close(): void {
        this.tables = new Map();
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
            let expressions = await this.tables.get(Tables.EXPRESSION).find({
                type: WordType.WORD,
                date: { $gte: span.from, $lte: span.to }
            }).exec() as ExpressionsTable[];

            expressions.forEach(item => {
                today[item.status]++;
            })

            // 累计
            let accumulated = new Array(5).fill(0);
            expressions = await this.tables.get(Tables.EXPRESSION).find({
                type: WordType.WORD,
                date: { $gte: span.to }
            }).exec() as ExpressionsTable[];

            expressions.forEach(item => {
                accumulated[item.status]++;
            })

            res.push({ today, accumulated });
        }

        return res;
    }

    destroyAll(): Promise<void> {
        this.tables.forEach(item => {
            item.remove()
        })
        return null
    }

    exportDB(): Promise<void> {
        return Promise.resolve(undefined);
    }

    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        let expressions = await this.tables.get(Tables.EXPRESSION).find({ status: { gt: ignores ? -1 : 0 } }).exec() as ExpressionsTable[];

        let res: ExpressionInfoSimple[] = [];
        for (let i in expressions) {
            let expr = expressions[i]
            console.log(expr)
            res.push({
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.type,
                tags: JSON.parse(expr.tags as string),
                note_num: await this.tables.get(Tables.NOTES).count({ eid: expr._id }).exec() as number,
                sen_num: expr.sentences.size,
                date: expr.date,
            });
        }

        return res;
    }

    async getCount(): Promise<CountInfo> {
        let word_count = await this.tables.get(Tables.EXPRESSION).count({ type: WordType.WORD }).exec() as number;
        let phrase_count = await this.tables.get(Tables.EXPRESSION).count({ type: WordType.PHRASE }).exec() as number;

        return {
            word_count: [word_count],
            phrase_count: [phrase_count]
        }
    }

    async getExpression(keyworkd: string): Promise<ExpressionInfo> {

        let hasExists = await this.tables.get(Tables.EXPRESSION).find({
            expression: keyworkd.toLocaleLowerCase()
        }).limit(1).exec() as ExpressionsTable[];

        if (hasExists === null || hasExists.length === 0) {
            return null;
        }

        let expression: ExpressionsTable = hasExists[0];
        let notes = await this.tables.get(Tables.NOTES).find({ eid: expression._id }).exec() as NotesTable[];

        let sentences: SentencesTable[] = [];
        for (let i in expression.sentences) {
            let sentence = await this.tables.get(Tables.SENTENCE).find({ _id: expression._id }).exec() as SentencesTable[];
            if (sentence.length > 0) {
                sentences = [...sentences, ...sentence];
            }
        }

        return {
            expression: expression.expression,
            meaning: expression.meaning,
            status: expression.status,
            t: expression.type,
            notes: notes.map(item => item.text),
            sentences: sentences,
            tags: [...JSON.parse(expression.tags as string)],
        }
    }

    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let expressions = await this.tables.get(Tables.EXPRESSION).find({
            status: 0,
            date: { $gte: unixStamp }
        }).exec() as ExpressionsTable[];


        let res: ExpressionInfo[] = [];
        for (let expr of expressions) {
            let orWhere = [];
            orWhere.push({ _id: expr.sentences.values() });

            let sentences = await this.tables.get(Tables.SENTENCE).find(orWhere).exec() as SentencesTable[];
            let notes = await this.tables.get(Tables.NOTES).find({ eid: expr._id }).exec() as NotesTable[];

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.type,
                notes: notes.map(item => item.text),
                sentences,
                tags: [...JSON.parse(expr.tags as string)],
            });
        }
        return res;

        return Promise.resolve([]);
    }

    async getExpressionsSimple(keywords: string[]): Promise<ExpressionInfoSimple[]> {
        let orWhere = keywords.map(e => {
            return { '$or': e.toLowerCase() }
        });

        let expressions = await this.tables
            .get(Tables.EXPRESSION)
            .find(orWhere)
            .exec() as ExpressionsTable[];

        let res: ExpressionInfoSimple[] = [];
        await expressions.forEach(async v => {
            res.push({
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.type,
                tags: [...JSON.parse(v.tags as string)],
                sen_num: v.sentences.size,
                note_num: await this.tables.get(Tables.NOTES).count({ eid: v._id }).exec() as number,
                date: v.date
            });
        });

        return res;
    }

    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {

        let storedPhrases = new Map<string, number>();
        (
            await this.tables.get(Tables.EXPRESSION).find({
                "type": WordType.PHRASE,
            }).exec() as ExpressionsTable[]
        ).forEach(expr => {
            storedPhrases.set(expr.expression, expr.status);
        });

        let storedWords = (await this.tables.get(Tables.EXPRESSION).find({
            "type": WordType.WORD,
            "expression": payload.words,
        }).exec() as ExpressionsTable[]).map(expr => {
            return { text: expr.expression, status: expr.status } as Word;
        });

        let ac = await createAutomaton([...storedPhrases.keys()]);
        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getTags(): Promise<string[]> {
        let expressions = await this.tables.get(Tables.EXPRESSION).find({}).exec() as ExpressionsTable[];

        let tags: string[] = [];
        expressions.forEach(item => {
            tags.push(...JSON.parse(item.tags as string));
        })


        return [...tags.unique().values()];
    }

    importDB(data: any): Promise<void> {
        return Promise.resolve(undefined);
    }

    open(): Promise<void> {
        this.init();
        return null;
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        let expression: ExpressionsTable | null = null;
        let hasExists = await this.tables.get(Tables.EXPRESSION).find({
            'expression': payload.expression
        }).limit(1).exec() as ExpressionsTable[];

        // update sentences
        let sentences = new Set<number>();
        for (let i in payload.sentences) {
            sentences.add(await this.tables.get(Tables.SENTENCE).insert({
                source: payload.sentences[i].text,
                trans: payload.sentences[i].trans,
                origin: payload.sentences[i].origin,
            }))
        }

        // 如果之前不存在情况新增
        if (hasExists === null || hasExists.length === 0) {
            expression = await this.tables.get(Tables.EXPRESSION).insert({
                expression: payload.expression,
                meaning: payload.meaning,
                status: payload.status,
                type: payload.t,
                tags: JSON.stringify(payload.tags),
                sentences: JSON.stringify(sentences),
                date: moment().unix(),
            }) as ExpressionsTable;
        } else {
            expression = hasExists[0]
            this.tables.get(Tables.EXPRESSION).update({ _id: expression._id, }, { $set: { date: moment().unix() } })

            // remove the old Sentence
            this.tables.get(Tables.CONNECTIONS).remove({ "eid": expression._id });

            // remove the old notes
            this.tables.get(Tables.NOTES).remove({ "eid": expression._id });
        }
        console.log(expression, 'info')

        // update notes
        for (let i in payload.notes) {
            this.tables.get(Tables.NOTES).insert({
                text: payload.notes[i],
                eid: expression._id,
            })
        }


        return 200;
    }

    async postIgnoreWords(payload: string[]): Promise<void> {
        const promises: Array<Promise<any>> = [];
        payload.forEach(doc => {
            promises.push(this.tables.get(Tables.EXPRESSION).update({
                expression: doc,
            }, {
                $set: {
                    expression: doc,
                    meaning: "",
                    status: 0,
                    type: WordType.WORD,
                    tags: JSON.stringify([]),
                    sentences: [],
                    date: moment().unix(),
                },
            }, { exactObjectFind: true, upsert: true }));


        });

        await Promise.all(promises);

        return;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        let stored = await this.tables.get(Tables.SENTENCE).find({ "text": text }).exec() as Sentence[];
        if (stored.length > 0) {
            return null;
        }

        return stored[0];
    }
}


