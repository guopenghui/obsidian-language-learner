interface ExpressionsTable {
    _id?: number | string
    expression: string
    meaning: string
    status: number
    t: string
    date: number
    tags: string[]
    notes: string[]
    sentences: number[] | string[]
    connections: string[]
}

interface SentencesTable {
    _id?: number | string
    text: string
    trans: string
    origin: string
}

export enum Tables {
    EXPRESSION = "Expression",
    SENTENCE = "Sentence",
}

export type {
    SentencesTable, ExpressionsTable
}

