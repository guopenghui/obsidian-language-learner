export interface Expression {
    id?: number | string,
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
export interface Sentence {
    id?: number | string;
    text: string,
    trans: string,
    origin: string,
}

export enum Tables {
    Expression = "Expression",
    Sentence = "Sentence"
}
