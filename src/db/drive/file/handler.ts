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
import { ElectronStorage } from '@qiyangxy/tedb-electron-storage';
import { createAutomaton } from "ac-auto";
import { moment } from 'obsidian';
import path from 'path';
import * as tedb from "tedb";
import DbProvider from '../../base';
import { ExpressionsTable, SentencesTable, Tables } from '../types';

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
        this.basePath = (app.vault.adapter as any).getBasePath();

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
                t: WordType.WORD,
                date: { $gte: span.from, $lte: span.to }
            }).exec() as ExpressionsTable[];

            expressions.forEach(item => {
                today[item.status]++;
            })

            // 累计
            let accumulated = new Array(5).fill(0);
            expressions = await this.tables.get(Tables.EXPRESSION).find({
                t: WordType.WORD,
                date: { $lte: span.to }
            }).exec() as ExpressionsTable[];

            expressions.forEach(item => {
                accumulated[item.status]++;
            })
            console.log({ today, accumulated })

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
        let expressions = await this.tables.get(Tables.EXPRESSION).find({ status: { $gt: ignores ? -1 : 0 } }).exec() as ExpressionsTable[];

        let res: ExpressionInfoSimple[] = [];
        for (let expr of expressions) {
            res.push({
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.t,
                tags: expr.tags,
                note_num: expr.notes.length,
                sen_num: expr.sentences.length,
                date: expr.date,
            });
        }

        return res;
    }

    async getCount(): Promise<CountInfo> {
        let word_count = await this.tables.get(Tables.EXPRESSION).count({ t: WordType.WORD }).exec() as number;
        let phrase_count = await this.tables.get(Tables.EXPRESSION).count({ t: WordType.PHRASE }).exec() as number;

        return {
            word_count: [word_count],
            phrase_count: [phrase_count]
        }
    }

    async $(keyworkd: string): Promise<ExpressionInfo> {

        let hasExists = await this.tables.get(Tables.EXPRESSION).find({
            expression: keyworkd.toLocaleLowerCase()
        }).limit(1).exec() as ExpressionsTable[];

        if (hasExists === null || hasExists.length === 0) {
            return null;
        }

        let expression: ExpressionsTable = hasExists[0];

        return {
            expression: expression.expression,
            meaning: expression.meaning,
            status: expression.status,
            t: expression.t,
            notes: expression.notes,
            sentences: await this.tables.get(Tables.SENTENCE).find({ _id: expression._id }).exec() as SentencesTable[],
            tags: expression.tags,
        }
    }

    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let expressions = await this.tables.get(Tables.EXPRESSION).find({
            status: {$gt: 0},
            date: { $gte: unixStamp }
        }).exec() as ExpressionsTable[];
        let res: ExpressionInfo[] = [];
        for (let expr of expressions) {
            let orWhere = [];
            for (let sentence of expr.sentences) {
                orWhere.push({ _id: sentence });
            }

            let sentences = await this.tables.get(Tables.SENTENCE).find(orWhere).exec() as SentencesTable[];

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: expr.tags,
            });
        }
        return res;
    }

    async getExpressionsSimple(keywords: string[]): Promise<ExpressionInfoSimple[]> {
        let orWhere = keywords.map(e => {
            return { expression: e.toLowerCase() }
        });

        let expressions = await this.tables
            .get(Tables.EXPRESSION)
            .find({$or: orWhere})
            .exec() as ExpressionsTable[];

        let res: ExpressionInfoSimple[] = [];
        await expressions.forEach(async v => {
            res.push({
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.t,
                tags: v.tags,
                sen_num: v.sentences.length,
                note_num: v.notes.length,
                date: v.date
            });
        });

        return res;
    }

    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {

        let storedPhrases = new Map<string, number>();
        (
            await this.tables.get(Tables.EXPRESSION).find({
                "t": WordType.PHRASE,
            }).exec() as ExpressionsTable[]
        ).forEach(expr => {
            storedPhrases.set(expr.expression, expr.status);
        });

        let storedWords = (await this.tables.get(Tables.EXPRESSION).find({
            "t": WordType.WORD,
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
            tags.push(...item.tags);
        })


        return [...tags.unique().values()];
    }

    async getExpression(keyword: string): Promise<ExpressionInfo> {
        keyword = keyword.toLowerCase();
        let expressions = await this.tables.get(Tables.EXPRESSION)
            .find({ expression: keyword }).exec() as ExpressionsTable[];

        if (!expressions || expressions.length <= 0) {
            return null;
        }

        let expr = expressions[0];
        let orWhere = [];
        for (let sen of expr.sentences) {
            orWhere.push({ _id: sen });
        }
        let sentences = await this.tables.get(Tables.SENTENCE).find({
            $or: orWhere
        }).exec() as SentencesTable[];

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
        let sentences = new Set<string>();
        for (let sen of payload.sentences) {
            let sens = await this.tables.get(Tables.SENTENCE).find({ text: sen.text }).exec() as SentencesTable[];
            let sentence = null;
            if (sens.length > 0) {
                sentence = sens[0]
            } else {
                sentence = await this.tables.get(Tables.SENTENCE).insert(sen)
            }

            sentences.add(sentence._id)
        }


        let data = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            tags: [... (new Set<string>(payload.tags).values())],
            connections: [] as string[],
            notes: payload.notes,
            sentences: [...sentences.values()],
            date: moment().unix(),
        }

        // 如果之前不存在情况新增
        if (hasExists === null || hasExists.length === 0) {
            expression = await this.tables.get(Tables.EXPRESSION).insert(data) as ExpressionsTable;
        } else {
            expression = hasExists[0]
            this.tables.get(Tables.EXPRESSION).update({ _id: expression._id, }, { $set: data })
        }
        console.log(
            await this.tables.get(Tables.EXPRESSION).find({
                'expression': payload.expression
            }).limit(1).exec() as ExpressionsTable[],
            expression,
            payload
        )

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
                    t: WordType.WORD,
                    connections: [],
                    tags: [],
                    notes: [],
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


