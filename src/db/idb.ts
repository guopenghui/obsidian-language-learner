import Dexie from "dexie"

export default class WordDB extends Dexie {
    expressions: Dexie.Table<Expression, number>;
    sentences: Dexie.Table<Sentence, number>;
    constructor() {
        super("WordDB")
        this.version(1).stores({
            expressions: "++id, &expression, status, t, date, *tags",
            sentences: "++id, &text"
        })
        this.open()
    }
}

interface Expression {
    id?: number,
    expression: string,
    meaning: string,
    status: number,
    t: string,
    date: number,
    notes: string[],
    tags: Set<string>,
    sentences: Set<number>,
    connections: Map<string, string>,
}
interface Sentence {
    id?: number;
    text: string,
    trans: string,
    origin: string,
}