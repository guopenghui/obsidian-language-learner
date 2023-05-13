interface ExpressionsTable {
    id?: number | string | null
    _id?: number | string 
    expression: string
    meaning: string
    status: number
    type: string
    date: number
    tags: Set<string>
    sentences: SentencesTable[]
}
interface ConnectionsTable {
    _id: string | number
    id: string | number
    eid_from: string
    eid_to: string
}
interface SentencesTable {
    id?: number | string | null
    _id?: number | string | null
    text: string
    trans: string
    origin: string
}

interface NotesTable {
    id: string | number
    _id: string | number
    eid: string | number
    text: string
}

export enum Tables {
    EXPRESSION = "Expression",
    SENTENCE = "Sentence",
    NOTES = 'Notes',
    CONNECTIONS = 'Connections',
}

export type {
    NotesTable, SentencesTable, ConnectionsTable, ExpressionsTable
}

