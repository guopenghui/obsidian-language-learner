import Dexie from "dexie";
import Plugin from "@/plugin";
import { ExpressionsTable, SentencesTable } from "../types";

export default class WordDB extends Dexie {
    expressions: Dexie.Table<ExpressionsTable, number>;
    sentences: Dexie.Table<SentencesTable, number>;

    plugin: Plugin;
    storageName: string;

    constructor(plugin: Plugin) {
        super(plugin.settings.storage.storage_name);
        this.plugin = plugin;
        this.storageName = plugin.settings.storage.storage_name;
        this.version(1).stores({
            expressions: "++_id, &expression, *status, t, date, *tags, nots, sentences, connections",
            sentences: "++_id, &text, &expression, &expression_id, date",
        });
    }
}

