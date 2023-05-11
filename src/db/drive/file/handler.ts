import DbProvider from '../../base';
import Plugin from '@/plugin';
import {
    ArticleWords,
    CountInfo,
    ExpressionInfo,
    ExpressionInfoSimple,
    Sentence,
    WordCount,
    WordsPhrase
} from "@/db/interface";
import * as tedb from "tedb";
import { Tables } from './types';
import { ElectronStorage } from '@qiyangxy/tedb-electron-storage';
import path from 'path';

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
        this.basePath = app.vault.adapter.getBasePath();

        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        this.dbDir = plugin.settings.db_dir;
        this.dbPath = path.join(this.basePath, this.dbDir);
        console.log(this.dbPath, 'path')
    }

    init() {
        this.tables
        .set(Tables.Expressions, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.Expressions, this.dbPath) }))
        .set(Tables.Connections, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.Connections, this.dbPath) }))
        .set(Tables.Tags, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.Tags, this.dbPath) }))
        .set(Tables.ExpressionTag, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.ExpressionTag, this.dbPath) }))
        .set(Tables.Notes, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.Notes, this.dbPath) }))
        .set(Tables.Sentences, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.Sentences, this.dbPath) }))
        .set(Tables.ExpressionSentence, new tedb.Datastore({ storage: new ElectronStorage(this.dbName, Tables.ExpressionSentence, this.dbPath) }));
    }

    close(): void {
        this.tables = new Map();
    }

    countSeven(): Promise<WordCount[]> {
        return Promise.resolve([]);
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

    getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        return Promise.resolve([]);
    }

    getCount(): Promise<CountInfo> {
        return Promise.resolve(undefined);
    }

    getExpression(expression: string): Promise<ExpressionInfo> {
        return Promise.resolve(undefined);
    }

    getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        return Promise.resolve([]);
    }

    getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        return Promise.resolve([]);
    }

    getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        return Promise.resolve(undefined);
    }

    getTags(): Promise<string[]> {
        return Promise.resolve([]);
    }

    importDB(data: any): Promise<void> {
        return Promise.resolve(undefined);
    }

    open(): Promise<void> {
        this.init();
        return null;
    }

    postExpression(payload: ExpressionInfo): Promise<number> {
        return Promise.resolve(0);
    }

    postIgnoreWords(payload: string[]): Promise<void> {
        return Promise.resolve(undefined);
    }

    tryGetSen(text: string): Promise<Sentence> {
        return Promise.resolve(undefined);
    }
}


