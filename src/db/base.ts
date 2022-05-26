import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span
} from "./interface"


abstract class DbProvider {
    // 寻找页面中已经记录过的单词和词组
    abstract getStoredWords(payload: ArticleWords): Promise<WordsPhrase>;
    abstract getExpression(expression: string): Promise<ExpressionInfo>;
    abstract getExpressionAfter(time: string): Promise<ExpressionInfo[]>;
    abstract getExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]>;
    abstract postExpression(payload: ExpressionInfo): Promise<number>;
    abstract getTags(): Promise<string[]>;
    abstract postIgnoreWords(payload: string[]): Promise<void>;
    abstract tryGetSen(text: string): Promise<Sentence>;
    abstract getCount(): Promise<CountInfo>;
    abstract countSeven(): Promise<WordCount[]>;
    abstract destroyAll(): Promise<void>;
}


export default DbProvider