import { 
    normalizePath,
    Platform,
    moment,
    MetadataCache, } from "obsidian";
import { createAutomaton, Automaton } from "ac-auto";
import { exportDB, importInto } from "dexie-export-import";
import download from "downloadjs";
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span
} from "./interface";
import DbProvider from "./base";
import {WordDB,Expression} from "./idb";
import Plugin from "@/plugin";

export class FileDb extends DbProvider {
    idb: WordDB;
    plugin: Plugin;
    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }
    
    async open() {
        await this.idb.open();
        return;
    }

    close() {
        this.idb.close();
    }

    async getFilesPath(){
        var filesPath = (await this.plugin.app.vault.adapter.list(normalizePath(this.plugin.settings.word_folder))).files; 
        return filesPath;
    }

    // 寻找页面中已经记录过的单词和词组
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        //查询存储的短语（名字，状态）
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => {
                storedPhrases.set(expr.expression, expr.status)
                if(expr.aliases){
                    for(let item of expr.aliases){
                        storedPhrases.set(item, expr.status)
                    }
                }
            });

        var wordsinfo = await this.plugin.parserAllFM();
        wordsinfo
            .filter(word => word.t === "PHRASE")
            .forEach(word => {
                storedPhrases.set(word.expression, word.status);
                if(word.aliases){
                    for(let item of word.aliases){
                        storedPhrases.set(item, word.status)
                    }
                }
            });
        //对文章进行搜索，找到匹配的表达式，并将结果映射为 { text, status, offset } 形式的 Phrase 对象数组，其中 offset 是文章匹配的起始位置。
        let ac = await createAutomaton([...storedPhrases.keys()]);
        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        //查询存储的单词
        let storedWordsExpression = await this.idb.expressions
        .where("expression").anyOf(payload.words)
        .toArray();
        // 转换为 Word 类型数组
        let storedWords1 = storedWordsExpression.map(expr => ({
            text: expr.expression,
            status: expr.status
            }) as Word);
            
        // 查询aliases中 payload.words 中的英文单词的记录
        let storedWords2 = await this.idb.expressions
            .toArray()
            .then(expressions => {
                return expressions
                    .filter(expr => {
                        if(expr.aliases&&expr.aliases.length > 0){
                            return expr.aliases.some(word => payload.words.includes(word));
                        }else{
                            return;
                        }
                    })
                    .flatMap(expr => {
                        return expr.aliases.map(word => ({
                            expression: word, 
                            status: expr.status
                        }));
                    });
            }) as Word[];

        let storedWords3 = wordsinfo.filter(expr => {
                if(expr.aliases&&expr.aliases.length > 0){
                    return expr.aliases.some(word => payload.words.includes(word));
                }else{
                    return;
                }
            }).flatMap(expr => {
            //let meanings = extractEnglishWords(expr.meaning);
            return expr.aliases.map(word => ({
                text: word,  // 更新 expression 字段为匹配的英文单词
                status: expr.status}));
        })as Word[];

        let storedWords4: Word[] = wordsinfo
        .filter(word => {
            return payload.words.includes(word.expression);
        })
        .map(word => ({
            text: word.expression,
            status: word.status
        })) as Word[];

        let storedWords = [...storedWords1, ...storedWords2,...storedWords3,...storedWords4];

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        let expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            expr = await this.idb.expressions
            .filter(item => item.aliases?.includes(expression)).first();
            if(!expr){
                var wordsinfo = await this.plugin.parserAllFM();
                return  wordsinfo.find(word => word.expression === expression|| word.aliases.some(alias => expression === alias)) || null;
            }
        }

        let sentences = await this.idb.sentences
            .where("id").anyOf([...expr.sentences.values()])
            .toArray();
        return {
            expression: expr.expression,
            meaning: expr.meaning,
            status: expr.status,
            t: expr.t,
            notes: expr.notes,
            sentences,
            tags: [...expr.tags.keys()],
            aliases:expr.aliases,
            date: expr.date,
        };

    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(e => e.toLowerCase());

        let exprs1 = (await this.idb.expressions
            .where("expression")
            .anyOf(expressions)
            .toArray())
            .map(v => {
            return {
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.t,
                tags: [...v.tags.keys()],
                sen_num: v.sentences.size,
                note_num: v.notes.length,
                date: v.date,
                aliases: v.aliases,
            };
        }) as ExpressionInfoSimple[];

        let exprs2 = (await this.plugin.parserAllFM())
            .filter(word => expressions.includes(word.expression)|| word.aliases.some(alias => expressions.includes(alias)))
            .map(v => {
                return {
                    expression: v.expression,
                    meaning: v.meaning,
                    status: v.status,
                    t: v.t,
                    tags: v.tags,
                    sen_num: v.sentences.length,
                    note_num: v.notes.length,
                    date: v.date,
                    aliases: v.aliases,
                }})as ExpressionInfoSimple[];

        return [...exprs1,...exprs2];
    }

    async getExprall(expressions: string[]): Promise<ExpressionInfo[]> {
        expressions = expressions.map(expression => expression.toLowerCase());
        return  (await this.plugin.parserAllFM())
            .filter(word => expressions.includes(word.expression)|| word.aliases.some(alias => expressions.includes(alias)));
    }



    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp)
            .toArray();

        let res: ExpressionInfo[] = [];
        for (let expr of wordsAfter) {
            let sentences = await this.idb.sentences
                .where("id").anyOf([...expr.sentences.values()])
                .toArray();

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags.keys()],
                aliases: expr.aliases,
                date: expr.date,
            });
        }

        let exprs2 = (await this.plugin.parserAllFM())
            .filter(word => word.date>unixStamp);

        return [...res,...exprs2];
    }

    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        //let exprs: ExpressionInfoSimple[];
        //let bottomStatus = ignores ? -1 : 0;

        let exprs1 = (await this.plugin.parserAllFM())
            .map(v => {
                return {
                    expression: v.expression,
                    meaning: v.meaning,
                    status: v.status,
                    t: v.t,
                    tags: v.tags,
                    sen_num: v.sentences.length,
                    note_num: v.notes.length,
                    date: v.date,
                    aliases: v.aliases,
                }})as ExpressionInfoSimple[];
        if(ignores){
            let exprs2 = (await this.idb.expressions.toArray())
            .map((expr): ExpressionInfoSimple => {
                return {
                    expression: expr.expression,
                    status: expr.status,
                    meaning: expr.meaning,
                    t: expr.t,
                    tags: [...expr.tags.keys()],
                    note_num: expr.notes.length,
                    sen_num: expr.sentences.size,
                    date: expr.date,
                    aliases:expr.aliases,
                };
            })as ExpressionInfoSimple[];
            return [...exprs1,...exprs2];
        }else{
            return exprs1;
        }
        
    }

    async postExpression(payload: ExpressionInfo): Promise<number> {
        payload.date = moment().unix();
        var stored = await this.idb.expressions
        .where("expression").equals(payload.expression)
        .first();
        var path = this.plugin.settings.word_folder;
        if (path[path.length - 1] === '/') {
            var filePath = path+ `${payload.expression}.md`;
        } else {
            var filePath = path+ '/'+`${payload.expression}.md`;
        }
        await this.plugin.checkPath();
        if(payload.status){
            var fm = await this.plugin.createFM(payload);
            try{
                await app.vault.create(filePath,fm);
            }catch(err){
                if (err.message.includes('File already exists')){
                    this.plugin.app.vault.adapter.write(normalizePath(filePath),fm);
                };
            }
            if(stored){
                this.idb.expressions.delete(stored.id);
            }

        }else{
            let sentences = new Set<number>();
            for (let sen of payload.sentences) {
                let searched = await this.idb.sentences.where("text").equals(sen.text).first();
                if (searched) {
                    await this.idb.sentences.update(searched.id, sen);
                    sentences.add(searched.id);
                } else {
                    let id = await this.idb.sentences.add(sen);
                    sentences.add(id);
                }
            }

            let updatedWord = {
                expression: payload.expression,
                meaning: payload.meaning,
                status: payload.status,
                t: payload.t,
                notes: payload.notes,
                sentences,
                tags: new Set<string>(payload.tags),
                aliases: payload.aliases,
                date: moment().unix()
            };
            if (stored) {
                await this.idb.expressions.update(stored.id, updatedWord);
            } else {
                await this.idb.expressions.add(updatedWord);
            }
            try{
                let file = app.vault.getAbstractFileByPath(filePath);
                await app.vault.delete(file);
            }catch(err){}

        }

        return 200;
    }

    async getTags(): Promise<string[]> {
        let allTags = new Set<string>();
        for(var exp of (await this.plugin.parserAllFM())){
                for(var tag of exp.tags){allTags.add(tag)}
         }
        await this.idb.expressions.each(expr => {
            for (let t of expr.tags.values()) {
                allTags.add(t);
            }
        });
        return [...allTags.values()];
    }

    async postIgnoreWords(payload: string[]): Promise<void> {

        await this.idb.expressions.bulkPut(
            payload.map(expr => {
                return {
                    expression: expr,
                    meaning: "",
                    status: 0,
                    t: "WORD",
                    notes: [],
                    sentences: new Set(),
                    tags: new Set(),
                    aliases: [],
                    date: moment().unix(),
                };
            })
        );
        return;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        let stored = (await this.plugin.parserAllFM()).find(word => word.sentences.find(sentence =>sentence.text===text));
        if(stored){
            return stored.sentences.find(sentence =>sentence.text===text);
        }else{
            let store = await this.idb.sentences.where("text").equals(text).first();
            return store;
        } 
    }

    async getCount(): Promise<CountInfo> {
        let counts: { "WORD": number[], "PHRASE": number[]; } = {
            "WORD": new Array(5).fill(0),
            "PHRASE": new Array(5).fill(0),
        };
        (await this.plugin.parserAllFM()).every(word => {
            counts[word.t as "WORD" | "PHRASE"][word.status]++;
        });
        // await this.idb.expressions.each(expr => {
        //     counts[expr.t as "WORD" | "PHRASE"][expr.status]++;
        // });
        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE
        };
    }

    async countSeven(): Promise<WordCount[]> {
        let spans: Span[] = [];
        spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let start = moment().subtract(6, "days").startOf("day");
            let from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        let res: WordCount[] = [];
        let word = await this.plugin.parserAllFM();
        // 对每一天计算
        for (let span of spans) {
            // 当日
            let today = new Array(5).fill(0);
            word.filter(expr => {
                return expr.t == "WORD" &&
                    expr.date >= span.from &&
                    expr.date <= span.to;
            }).every(expr => {
                today[expr.status]++;
            });
            // 累计
            let accumulated = new Array(5).fill(0);
            word.filter(expr => {
                return expr.t == "WORD" &&
                    expr.date <= span.to;
            }).every(expr => {
                accumulated[expr.status]++;
            });

            res.push({ today, accumulated });
        }

        return res;
    }

    async importDB(file: File) {
        await this.idb.delete();
        await this.idb.open();
        await importInto(this.idb, file, {
            acceptNameDiff: true
        });
    }

    async exportDB() {
        let blob = await exportDB(this.idb);
        try {
            download(blob, `${this.idb.dbName}.json`, "application/json");
        } catch (e) {
            console.error("error exporting database");
        }
    }

    async destroyAll() {
        return this.idb.delete();
    }
}


