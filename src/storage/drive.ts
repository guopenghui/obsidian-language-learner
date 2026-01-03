import {
    ArticleWords, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, ReviewWord
} from "./interface";

export interface Paginate {
    pageSize: number, page: number
}

export interface PaginateResult<T> {
    data: T, total: number, page: number, pageSize: number
}

export interface SortParams {
    [key: string]: any
}

abstract class StorageDrive {
    abstract open(): Promise<void>;
    abstract close(): void;
    // 在文章中寻找之前记录过的单词和词组
    abstract getStoredWords(payload: ArticleWords): Promise<WordsPhrase>;
    // 查询单个单词/词组的全部信息
    abstract getExpression(expression: string): Promise<ExpressionInfo>;
    //获取一批单词的简略信息
    abstract getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]>;
    // 某一时间之后添加的全部单词
    abstract getExpressionAfter(time: string): Promise<ReviewWord[]>;
    // 获取全部单词的简略信息
    abstract getAllExpressionSimple(ignores?: boolean, search?: SortParams, sort?:SortParams, paginate?: Paginate): Promise<PaginateResult<any>>;
    // 发送单词信息到数据库保存
    abstract postExpression(payload: ExpressionInfo): Promise<number>;
    // 移除单词
    abstract removeExpression(expression: string): Promise<boolean>;
    // 获取所有tag
    abstract getTags(): Promise<string[]>;
    // 批量发送单词，全部标记为ignore
    abstract postIgnoreWords(payload: string[]): Promise<void>;
    // 查询一个例句是否已经记录过
    abstract tryGetSen(text: string): Promise<Sentence>;
    // 获取各类单词的个数
    abstract getCount(): Promise<CountInfo>;
    // 获取7天内的统计信息
    abstract countSeven(): Promise<WordCount[]>;
    // 销毁数据库
    abstract destroyAll(): Promise<void>;
    // 导入数据库
    abstract importDB(data: File, format: 'json' | 'csv' | 'sqlite3'): Promise<void>;
    // 导出数据库
    abstract exportDB(): Promise<void>;
}


export default StorageDrive;
