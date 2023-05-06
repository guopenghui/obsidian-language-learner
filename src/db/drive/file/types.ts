export interface ExpressionsTable {
    id: String
    expression: String
    meaning: String
    status: Number
    type: String
    created_at: String
    date: String
}

export interface ConnectionsTable {
    id: String
    eid_from: String
    eid_to: String
}

export interface TagsTable {
    id: String
    name: String
}

export interface ExpressionTagTable {
    eid: String
    tid: String
}

export interface NotesTable {
    id: String
    eid: String
    text: String
}

export interface SentencesTable {
    id: String,
    source: String,
    trans: String,
    origin: String
}

export interface ExpressionSentenceTable {
    id: String
    eid: String
    sid: String
}

export enum Tables {
    Expressions = 'Expressions',
    Connections = 'Connections',
    Tags = 'Tags',
    ExpressionTag = 'ExpressionTag',
    Notes = 'Notes',
    Sentences = 'Sentences',
    ExpressionSentence = 'ExpressionSentence'
}


