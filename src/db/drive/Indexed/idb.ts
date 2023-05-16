import Dexie from "dexie";
import Plugin from "@/plugin";
import { ExpressionsTable, SentencesTable } from "../types";

export default class WordDB extends Dexie {
    expressions: Dexie.Table<ExpressionsTable, number>;
    sentences: Dexie.Table<SentencesTable, number>;
    plugin: Plugin;
    dbName: string;
    constructor(plugin: Plugin) {
        super(plugin.settings.db_name);
        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        this.version(1).stores({
            expressions: "++id, &expression, status, t, date, *tags",
            sentences: "++id, &text"
        });
    }
}

