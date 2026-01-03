interface ArticleWords {
    article: string;
    words: string[];
}

interface Word {
    text: string;
    status: number;
}

interface Phrase {
    text: string;
    status: number;
    offset: number;
}

interface WordsPhrase {
    words: Word[];
    phrases: Phrase[];
}

interface Sentence {
    trans: string;
    origin: string;
    expression: string
    sentence: string
    date?: number | string
}

interface ExpressionInfo {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
    connections: string[];
    date: number | string;
}

interface ExpressionInfoSimple {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    note_num: number;
    sen_num: number;
    date: number | string;
}

interface CountInfo {
    word_count: number[];
    phrase_count: number[];
}


interface Span {
    from: number;
    to: number;
}

interface WordCount {
    today: number[];
    accumulated: number[];
}

interface ReviewWord {
    title: string;
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
}

export enum WordType {
    WORD = 'WORD',
    PHRASE = 'PHRASE'
}


export type {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    ReviewWord
};
