import DbProvider from '../../base';
import  Plugin from '@/plugin';
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
import {ElectronStorage} from "tedb-electron-storage";



const fs = require("fs")
const pluginInfo = app.vault.adapter.getResourcePath(app.vault.configDir)
var dbPath = "F:/soft/github/note-test/note-test";

const Users = new tedb.Datastore({storage: new Storage("wordDb", "user", dbPath)});

Users.insert({"a": 1})    .then((doc) => {

        console.log(doc) // {_id: "...", name: "xyz", age: 30} 
    })
    .catch();
console.log(Users.find({a: 1})  .exec()
    .then((docs) => {
        console.log(docs); // {_id: "...", name: "xyz", age: 30}
    }))


export default class Sqllit3DB extends DbProvider {
    plugin: Plugin;
    dbName: string;
    dbPath: string;
    dbDir: string;
    // db: Database = null

    constructor(plugin: Plugin) {
        super();

        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        this.dbDir = plugin.settings.db_dir;
        this.dbPath = this.dbDir + this.dbName;
        console.log(this.dbPath, 'path')
    }

    close(): void {
        // this.db.close()
    }

    countSeven(): Promise<WordCount[]> {
        return Promise.resolve([]);
    }

    destroyAll(): Promise<void> {
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

        // let sqlite =  sqlite3.verbose();
        // console.info(this.dbPath, sqlite)
        // this.db = new sqlite.Database('./' + this.dbPath, (err) => {
        //     console.log(111, err)
        //     // new Notice(err.message)
        // });
        // (new Structure()).createTables(this.db);

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


