interface ExpressionsTable {
    _id?: number | string
    expression: string
    meaning: string
    status: number
    t: string
    date: number | string
    tags: string[]
    notes: string[]
    sentences: number[] | string[]
    connections: string[]
}

interface SentencesTable {
    _id?: number | string
    expression: string
    sentence: string
    trans: string
    origin: string
    date: number | string
}

interface TagsTable {
    _id?: number | string
    expression: string
    tag: string
    date: number | string
}

interface NotesTable {
    _id?: number | string
    expression: string
    note: string
    date: number | string
}

interface ConnectionsTable {
    _id?: number | string
    expression: string
    connection: string
    date: number | string
}

export enum Tables {
    EXPRESSION = "expressions",
    SENTENCE = "sentences",
    TAGS = "tags",
    NOTES = "notes",
    CONNECTIONS = "connections"
}

export type {
    SentencesTable,
    ExpressionsTable,
    TagsTable,
    NotesTable,
    ConnectionsTable
}

