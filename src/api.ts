import { requestUrl, RequestUrlParam, moment } from "obsidian";

export let option = {
    PORT: 2222,
};

interface ArticleWords {
    article: string;
    words: string[];
}

export interface Word {
    text: string;
    status: number;
}

export interface Phrase {
    text: string;
    status: number;
    offset: number;
}

interface WordsPhrase {
    words: Word[];
    phrases: Phrase[];
}

// 寻找页面中已经记录过的单词和词组
export async function getStoredWords(
    payload: ArticleWords
): Promise<WordsPhrase> {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/word_phrase`,
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
    };

    try {
        let response = await requestUrl(request);

        let data: WordsPhrase = response.json;
        return data;
    } catch (e) {
        console.warn("Error when getting parse info from server:" + e);
    }
}

interface Sentence {
    text: string;
    trans: string;
    origin: string;
}

export interface ExpressionInfo {
    expression: string;
    meaning: string;
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
}

export interface ExpressionInfoSimple {
    expression: string;
    meaning: string;
    status: number;
    t: string;
}

// 获取单词/词组的详细信息
export async function getExpression(
    expression: string
): Promise<ExpressionInfo> {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/words`,
        method: "POST",
        body: JSON.stringify(expression.toLowerCase()),
        contentType: "application/json",
    };

    try {
        let response = await requestUrl(request);
        return response.json;
    } catch (e) {
        console.warn("Error while getting data to server." + e);
    }
}

// 通过status查询单词/词组,获取简略信息
export async function getExpressionSimple(
    ignores?: boolean
): Promise<ExpressionInfoSimple[]> {
    let mode = ignores ? "all" : "no_ignore";

    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/words_simple/${mode}`,
        method: "GET",
    };

    try {
        let response = await requestUrl(request);
        console.log(response);

        return response.json;
    } catch (e) {
        console.warn("Error while getting data to server." + e);
    }
}

// 添加或更新单词/词组的信息
export async function postExpression(payload: ExpressionInfo) {
    // 数据库中一律保存小写
    payload.expression = payload.expression.toLowerCase();

    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/update`,
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
    };
    try {
        let response = await requestUrl(request);
        return response.status;
    } catch (e) {
        console.warn("Error while saving data to server." + e);
    }
}

// 获取所有的tag
export async function getTags(): Promise<string[]> {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/tags`,
        method: "GET",
    };

    try {
        let response = await requestUrl(request);
        return response.json;
    } catch (e) {
        console.warn("Error getting tags from server." + e);
    }
}

// 发送所有忽略的新词
export async function postIgnoreWords(payload: string[]) {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/ignores`,
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json",
    };

    try {
        await requestUrl(request);
    } catch (e) {
        console.warn("Error sending ignore words" + e);
    }
}

// 尝试查询已存在的例句
export async function tryGetSen(text: string) {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/sentence`,
        method: "POST",
        body: JSON.stringify(text),
        contentType: "application/json",
    };

    try {
        let res = await requestUrl(request);
        return res.json;
    } catch (e) {
        console.warn("Error trying to get sentence" + e);
    }
}

// 统计部分
// 获取各种类型的单词/词组类型
interface CountInfo {
    word_count: number[];
    phrase_count: number[];
}
export async function getCount(): Promise<CountInfo> {
    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/count_all`,
        method: "GET",
    };
    try {
        let response = await requestUrl(request);
        let wordsCount: CountInfo = response.json;
        return wordsCount;
    } catch (e) {
        console.warn("Error getting words count" + e);
    }
}

interface Span {
    from: number;
    to: number;
}

interface WordCount {
    today: number;
    accumulated: number;
}

// 获取包括今天在内的7天内每一天的新单词量和累计单词量
export async function count_seven(): Promise<WordCount[]> {
    let spans: Span[] = [];

    spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
        let start = moment().subtract(6, "days").startOf("day");
        let from = start.add(i, "days");
        return {
            from: from.unix(),
            to: from.endOf("day").unix(),
        };
    });

    let request: RequestUrlParam = {
        url: `http://localhost:${option.PORT}/count_time`,
        method: "POST",
        body: JSON.stringify(spans),
        contentType: "application/json",
    };

    try {
        let res = await requestUrl(request);

        return res.json;
    } catch (e) { }
}
