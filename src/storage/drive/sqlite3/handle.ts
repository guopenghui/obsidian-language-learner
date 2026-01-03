import StorageDrive, {
    Paginate,
    PaginateResult,
    SortParams,
} from "@/storage/drive";
import {
    ArticleWords,
    CountInfo,
    ExpressionInfo,
    ExpressionInfoSimple,
    Phrase,
    ReviewWord,
    Sentence,
    Word,
    WordCount,
    WordsPhrase,
    WordType,
} from "@/storage/interface";

import Plugin from "@/plugin";
import initSqlJs, { Database, SqlJsStatic, SqlJsConfig } from "sql.js";
import {  moment, normalizePath, Platform } from "obsidian";
import {
    ConnectionsTable,
    ExpressionsTable,
    NotesTable,
    SentencesTable,
    Tables,
    TagsTable,
} from "@/storage/drive/types";
import {
    connectionsTableTransform,
    expressionsTableTransform,
    mapSqlResultToTypedArray,
    mapSqlResultToTypedObject,
    notesTableTransform,
    sentencesTableTransform,
    tagsTableTransform,
} from "@/storage/drive/sqlite3/uitils";
import { createAutomaton } from "ac-auto";
import download from "downloadjs";

export class Sqlite3StorageDrive extends StorageDrive {
    plugin: Plugin;

    storageName: string;
    storagePath: string;
    storageDir: string;

    sqlJs: SqlJsStatic = null;
    storageDrive: Database = null;

    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.storageName = plugin.settings.storage.storage_name;
        this.storageDir =
            plugin.settings.storage.drive["sqlite3"].storage_dir || "storage";

        console.log("SQLite3 存储驱动初始化:");
        console.log("- storageDir:", this.storageDir);
        console.log("- storageName:", this.storageName);
        console.log("- platform:", Platform.isMobileApp ? "mobile" : "desktop");
    }

    async init() {
        const isMobile = Platform.isMobileApp;
        const dir = normalizePath(this.storageDir);

        console.log(
            `[${isMobile ? "Mobile" : "Desktop"}] 初始化 SQLite3 存储驱动`
        );

        const adapter = this.plugin.app.vault.adapter;


        try {
            // 创建存储目录路径
            if (!(await adapter.exists(dir))) {
                await adapter.mkdir(dir);
                console.log("创建存储目录：", dir);
            }
        } catch (mkdirError) {
            console.warn("创建目录失败：", mkdirError);
        }

        this.storagePath = normalizePath(
            dir + "/" + this.storageName + ".sqlite"
        );
        console.log(
            `[${isMobile ? "Mobile" : "Desktop"}] 数据库路径：`,
            this.storagePath
        );

        const wasmName = "sql-wasm.wasm";
        const pluginDir = normalizePath(".obsidian/plugins/" + this.plugin.manifest.id);

        let wasmPath = normalizePath(pluginDir + "/" + wasmName);

        // Check if wasm exists in plugin root, otherwise check node_modules (dev)
        if (!(await adapter.exists(wasmPath))) {
            wasmPath = normalizePath("/node_modules/sql.j/dist/" + wasmName);
        }

        console.log(
            `[${isMobile ? "Mobile" : "Desktop"}] WASM 路径：`,
            wasmPath
        );

        const config: SqlJsConfig = {};
        if (await adapter.exists(wasmPath)) {
            try {
                // 尝试使用 readBinary 方法
                if (typeof (adapter as any).readBinary === "function") {
                    config.wasmBinary = await (adapter as any).readBinary(
                        wasmPath
                    );
                    console.log(
                        `[${isMobile ? "Mobile" : "Desktop"}] WASM 文件加载成功`
                    );
                } else {
                    console.warn(
                        "adapter.readBinary 方法不可用，将从 CDN 加载 WASM 文件"
                    );
                }
            } catch (err) {
                console.error("Failed to read WASM file:", err);
                console.warn("将继续使用默认 WASM 加载方式（CDN）");
            }
        } else {
            console.warn("sql-wasm.wasm not found at", wasmPath);
            console.warn("将从 CDN 加载 WASM 文件");
        }

        try {
            this.sqlJs = await initSqlJs(config);
            console.log(
                `[${isMobile ? "Mobile" : "Desktop"}] SQL.js 初始化成功`
            );
        } catch (initError) {
            console.error("SQL.js 初始化失败：", initError);
            throw initError;
        }

        await this.initDatabase(adapter);

        // 创建初始数据表结构
        if (this.storageDrive) {
            this.createDbTables();
        }
    }

    async initDatabase(adapter: any) {
        try {
            // 检查本地数据库文件是否存在
            if (await adapter.exists(this.storagePath)) {
                console.log("找到现有数据库文件，正在加载...");

                // 读取本地数据库文件的二进制数据
                let dbData: ArrayBuffer;
                if (typeof adapter.readBinary === "function") {
                    dbData = await adapter.readBinary(this.storagePath);
                } else {
                    console.error(
                        "adapter.readBinary 方法不可用，无法加载数据库文件"
                    );
                    throw new Error(
                        "readBinary method not available on adapter"
                    );
                }

                // 加载已有数据库
                this.storageDrive = new this.sqlJs.Database(
                    new Uint8Array(dbData)
                );
     
            } else {
                // 本地文件不存在，创建新的数据库（初始为内存数据库，后续需导出到文件）
                console.log("未找到数据库文件，创建新数据库...");
                this.storageDrive = new this.sqlJs.Database();
            }
        } catch (error) {
            console.error(
                `初始化数据库失败 [${
                    Platform.isMobileApp ? "Mobile" : "Desktop"
                }]：`,
                error
            );
            console.error("错误详情：", {
                storagePath: this.storagePath,
                errorMessage:
                    error instanceof Error ? error.message : String(error),
            });
            // 异常时创建新数据库兜底
            this.storageDrive = new this.sqlJs.Database();
            console.warn("已创建内存数据库作为降级方案");
        }
    }

    createDbTables() {
        if (!this.storageDrive) return;

        this.storageDrive.run(`
            CREATE TABLE IF NOT EXISTS  expressions (
                 _id INTEGER  PRIMARY KEY AUTOINCREMENT,
                 expression text not null,
                 meaning text default '',
                 status INTEGER default 0,
                 t text default '',
                 date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE UNIQUE INDEX IF NOT EXISTS  "expression_index" ON "expressions" ( "expression" ASC);

            CREATE INDEX IF NOT EXISTS "status_index" ON "expressions" ( "status");

            CREATE INDEX IF NOT EXISTS "t_index" ON "expressions" ( "t");
        `);

        this.storageDrive.run(`
            CREATE TABLE IF NOT EXISTS tags (
                _id INTEGER  PRIMARY KEY AUTOINCREMENT,
                expression text not null,
                tag text,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS  "tag_expression_index" ON "tags" ("expression" );
        `);

        this.storageDrive.run(`
            CREATE TABLE IF NOT EXISTS notes (
                 _id INTEGER  PRIMARY KEY AUTOINCREMENT,
                 expression text not null,
                 note text,
                 date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS "note_expression_index" ON "notes" ("expression" );
        `);

        this.storageDrive.run(`
            CREATE TABLE IF NOT EXISTS sentences (
                 _id INTEGER  PRIMARY KEY AUTOINCREMENT,
                 expression text not null,
                 sentence text,
                 trans text default '',
                 origin  text default '',
                 date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS "sentence_expression_index" ON "sentences" ("expression" );
        `);

        this.storageDrive.run(`
            CREATE TABLE IF NOT EXISTS connections (
               _id INTEGER  PRIMARY KEY AUTOINCREMENT,
               expression text not null,
               connection text,
               date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS "connection_expression_index" ON "connections" ("expression" );
        `);

        this.exportDbToFile();
    }

    async open(): Promise<void> {
        if (this.storageDrive) {
            this.storageDrive?.close();
            this.storageDrive = null;
        }

        if (this.sqlJs) {
            this.sqlJs = null;
        }

        await this.init();
    }

    close(): void {
        this.storageDrive?.close();
        this.sqlJs = null;
    }

    async exportDbToFile() {
        if (!this.storageDrive) return;

        try {
            const adapter = this.plugin.app.vault.adapter;
            const isMobile = Platform.isMobileApp;

            console.log(
                `[${isMobile ? "Mobile" : "Desktop"}] 开始导出数据库到文件：`,
                this.storagePath
            );

            // 1. 将数据库导出为二进制数组
            const dbData = this.storageDrive.export();

            // 2. 确保目录存在
            const dir = this.storagePath.substring(
                0,
                this.storagePath.lastIndexOf("/")
            );
            try {
                if (!(await adapter.exists(dir))) {
                    await adapter.mkdir(dir);
                    console.log("创建存储目录：", dir);
                }
            } catch (mkdirError) {
                console.warn("创建目录失败，可能目录已存在：", mkdirError);
            }

            // 3. 将 Uint8Array 转换为 ArrayBuffer
            // 使用 slice 方法创建一个新的 ArrayBuffer，避免 SharedArrayBuffer 问题
            const arrayBuffer = new ArrayBuffer(dbData.byteLength);
            const view = new Uint8Array(arrayBuffer);
            view.set(dbData);

            // 4. 写入文件
            // 在移动端和桌面端都使用标准的 writeBinary 方法
            // Obsidian 的 adapter 在移动端会自动处理文件系统差异
            if (typeof (adapter as any).writeBinary === "function") {
                await (adapter as any).writeBinary(
                    this.storagePath,
                    arrayBuffer
                );
            } else {
                // 如果 writeBinary 不可用，抛出错误
                // 因为 write 方法只接受 string 或 ArrayBuffer，不能直接使用 Uint8Array
                throw new Error(
                    "adapter.writeBinary method not available. Cannot write binary data to file."
                );
            }

            console.log(
                `[${
                    isMobile ? "Mobile" : "Desktop"
                }] 数据库已成功持久化到文件：`,
                this.storagePath
            );
        } catch (error) {
            console.error(
                `数据库持久化导出失败 [${
                    Platform.isMobileApp ? "Mobile" : "Desktop"
                }]：`,
                error
            );
            console.error("错误详情：", {
                storagePath: this.storagePath,
                platform: Platform.isMobileApp ? "mobile" : "desktop",
                errorMessage:
                    error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
            });

            // 移动端可能需要特殊处理
            if (Platform.isMobileApp) {
                console.warn("移动端文件系统可能受限，数据库仅在内存中运行");
                // 可以考虑添加用户提示
            }
        }
    }

    async countSeven(): Promise<WordCount[]> {
        if (!this.storageDrive) return Promise.resolve([]);

        const spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            const start = moment().subtract(6, "days").startOf("day");
            const from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        const counts: WordCount[] = [];

        // 对每一天计算
        for (const span of spans) {
            // 当日
            const today = new Array(5).fill(0);

            const todayResult = this.storageDrive.exec(
                "select * from " +
                    Tables.EXPRESSION +
                    " INDEXED BY t_index where t = ? and date >= ? and date <= ? order by date desc",
                [WordType.WORD, span.from, span.to]
            );
            if (todayResult.length > 0) {
                const expression = mapSqlResultToTypedArray<ExpressionsTable>(
                    todayResult[0],
                    expressionsTableTransform
                );
                expression.forEach((expr) => {
                    today[expr.status]++;
                });
            }

            // 累计
            const accumulated = new Array(5).fill(0);
            const accumulatedResult = this.storageDrive.exec(
                "select * from " +
                    Tables.EXPRESSION +
                    " INDEXED BY t_index where t = ? and date <= ? order by date desc",
                [WordType.WORD, span.to]
            );
            if (accumulatedResult.length > 0) {
                const expression = mapSqlResultToTypedArray<ExpressionsTable>(
                    accumulatedResult[0],
                    expressionsTableTransform
                );
                expression.forEach((expr) => {
                    accumulated[expr.status]++;
                });
            }

            counts.push({ today, accumulated });
        }

        return counts;
    }

    destroyAll(): Promise<void> {
        this.storageDrive.run(`
            DROP TABLE IF EXISTS "expressions";
            DROP TABLE IF EXISTS "tags";
            DROP TABLE IF EXISTS "notes";
            DROP TABLE IF EXISTS "sentences";
            DROP TABLE IF EXISTS "connections";
        `);

        this.exportDbToFile();
        return null;
    }

    async exportDB() {
        const blob = this.storageDrive.export();

        try {
            download(blob, `${this.storageName}.sqlite`, "application/sqlite");
        } catch (error) {
            console.error("数据库持久化导出失败：", error);
        }
    }

    async getAllExpressionSimple(
        ignores?: boolean,
        sort?: SortParams,
        search?: { [key: string]: any },
        paginate?: Paginate
    ): Promise<PaginateResult<ExpressionInfoSimple[]>> {
        const bottomStatus = ignores ? -1 : 0;
        const pageSize = paginate?.pageSize || 100;
        const page = paginate?.page || 0; // 接收 0-based 页码

        // 构建 WHERE 子句
        const whereConditions: string[] = ["status >= ?"];
        const whereParams: any[] = [bottomStatus];

        // 处理搜索条件（模糊搜索）
        if (search && Object.keys(search).length > 0) {
            for (const [key, value] of Object.entries(search)) {
                if (value !== undefined && value !== null && value !== "") {
                    // 支持 expression 和 meaning 字段的模糊搜索
                    if (key === "expression" || key === "meaning") {
                        whereConditions.push(`${key} LIKE ?`);
                        whereParams.push(`%${value}%`);
                    }
                    // 精确匹配字段（status, t 等）
                    else if (key === "status") {
                        whereConditions.push(`${key} = ?`);
                        whereParams.push(value);
                    } else if (key === "t") {
                        whereConditions.push(`${key} = ?`);
                        whereParams.push(value);
                    }
                    // 支持标签搜索（数组：包含任意一个标签即可）
                    else if (key === "tags" && Array.isArray(value) && value.length > 0) {
                        const tagConditions = value.map(() => "EXISTS (SELECT 1 FROM " + Tables.TAGS + " WHERE " + Tables.TAGS + ".expression = " + Tables.EXPRESSION + ".expression AND tag = ?)");
                        whereConditions.push(`(${tagConditions.join(" OR ")})`);
                        whereParams.push(...value);
                    }
                }
            }
        }

        const whereClause = whereConditions.join(" AND ");

        // 构建 ORDER BY 子句
        let orderClause = "date desc"; // 默认排序
        if (sort && Object.keys(sort).length > 0) {
            const orderParts: string[] = [];
            for (const [key, value] of Object.entries(sort)) {
                // 支持的字段：expression, meaning, status, date
                if (["expression", "meaning", "status", "date"].includes(key)) {
                    const orderDirection =
                        value === "asc" || value === "ASC" ? "ASC" : "DESC";
                    orderParts.push(`${key} ${orderDirection}`);
                }
            }
            if (orderParts.length > 0) {
                orderClause = orderParts.join(", ");
            }
        }

        // 查询总数
        const totalSql = `SELECT COUNT(_id) as count FROM ${Tables.EXPRESSION} WHERE ${whereClause}`;
        const totalResult = this.storageDrive.exec(totalSql, whereParams);

        if (totalResult.length <= 0) {
            return {
                data: [],
                total: 0,
                page: 1,
                pageSize: 0,
            };
        }

        // 查询数据
        const dataSql = `SELECT * FROM ${Tables.EXPRESSION} WHERE ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
        const exprsResult = this.storageDrive.exec(dataSql, [
            ...whereParams,
            pageSize,
            page * pageSize,
        ]);

        if (exprsResult.length <= 0) {
            return {
                data: [],
                total: Number(totalResult[0].values[0][0] || 0),
                page: page + 1,
                pageSize,
            };
        }

        const exprs = mapSqlResultToTypedArray<ExpressionsTable>(
            exprsResult[0],
            expressionsTableTransform
        );

        // 批量查询所有 expression 的 tags
        const expressionsList = exprs.map((e) => e.expression);
        const allTagsResult = this.storageDrive.exec(
            "select * from " +
                Tables.TAGS +
                " INDEXED BY tag_expression_index where expression in (" +
                expressionsList.map(() => "?").join(",") +
                ")",
            expressionsList
        );

        // 构建 expression -> tags 的映射
        const tagsMap = new Map<string, string[]>();
        if (allTagsResult.length > 0) {
            const tags = mapSqlResultToTypedArray<TagsTable>(
                allTagsResult[0],
                tagsTableTransform
            );
            tags.forEach((tag) => {
                if (!tagsMap.has(tag.expression)) {
                    tagsMap.set(tag.expression, []);
                }
                tagsMap.get(tag.expression).push(tag.tag);
            });
        }

        // 批量查询所有 expression 的 note 数量
        const notesMap = new Map<string, number>();
        if (expressionsList.length > 0) {
            const allNotesResult = this.storageDrive.exec(
                "select expression, count(_id) as count from " +
                    Tables.NOTES +
                    " INDEXED BY note_expression_index where expression in (" +
                    expressionsList.map(() => "?").join(",") +
                    ") group by expression",
                expressionsList
            );

            // 构建 expression -> note_num 的映射
            if (
                allNotesResult.length > 0 &&
                allNotesResult[0].values.length > 0
            ) {
                allNotesResult[0].values.forEach((row: any[]) => {
                    notesMap.set(String(row[0]), Number(row[1] || 0));
                });
            }
        }

        // 批量查询所有 expression 的 sentence 数量
        const sentencesMap = new Map<string, number>();
        if (expressionsList.length > 0) {
            const allSentencesResult = this.storageDrive.exec(
                "select expression, count(_id) as count from " +
                    Tables.SENTENCE +
                    " INDEXED BY sentence_expression_index where expression in (" +
                    expressionsList.map(() => "?").join(",") +
                    ") group by expression",
                expressionsList
            );

            // 构建 expression -> sen_num 的映射
            if (
                allSentencesResult.length > 0 &&
                allSentencesResult[0].values.length > 0
            ) {
                allSentencesResult[0].values.forEach((row: any[]) => {
                    sentencesMap.set(String(row[0]), Number(row[1] || 0));
                });
            }
        }

        // 组装结果
        const data = exprs.map((expr) => {
            return {
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                tags: tagsMap.get(expr.expression) || [],
                note_num: notesMap.get(expr.expression) || 0,
                sen_num: sentencesMap.get(expr.expression) || 0,
                date: expr.date,
            } as ExpressionInfoSimple;
        });

        return {
            data,
            total: Number(totalResult[0].values[0][0] || 0),
            pageSize,
            page: page + 1, // 返回 1-based 页码给前端
        };
    }

    async getCount(): Promise<CountInfo> {
        const counts: { WORD: number[]; PHRASE: number[] } = {
            WORD: new Array(5).fill(0),
            PHRASE: new Array(5).fill(0),
        };

        const exprsResult = this.storageDrive.exec(
            "select * from " + Tables.EXPRESSION + " INDEXED BY t_index"
        );
        if (exprsResult.length > 0) {
            const expression = mapSqlResultToTypedArray<ExpressionsTable>(
                exprsResult[0],
                expressionsTableTransform
            );
            expression.forEach((expr) => {
                counts[expr.t as WordType][expr.status]++;
            });
        }

        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE,
        };
    }

    async getExpression(keyword: string): Promise<ExpressionInfo> {
        keyword = keyword.toLowerCase();
        const exprsResult = this.storageDrive.exec(
            "select * from " +
                Tables.EXPRESSION +
                " INDEXED BY expression_index where expression = ? limit 1",
            [keyword]
        );
        if (exprsResult.length <= 0) {
            return null;
        }

        const exprs = mapSqlResultToTypedObject<ExpressionsTable>(
            exprsResult[0],
            expressionsTableTransform
        );
        const result: ExpressionInfo = {
            expression: exprs.expression,
            meaning: exprs.meaning,
            status: exprs.status,
            t: exprs.t,
            tags: [],
            notes: [],
            sentences: [] as Sentence[], // 明确指定类型
            connections: [],
            date: exprs.date,
        };

        const tagsResult = this.storageDrive.exec(
            "select * from " +
                Tables.TAGS +
                " INDEXED BY tag_expression_index where expression = ?",
            [exprs.expression]
        );
        if (tagsResult.length > 0) {
            const tags = mapSqlResultToTypedArray<TagsTable>(
                tagsResult[0],
                tagsTableTransform
            );
            result.tags = tags.map((tag) => tag.tag);
        }

        const notesResult = this.storageDrive.exec(
            "select * from " +
                Tables.NOTES +
                " INDEXED BY note_expression_index where expression = ?",
            [exprs.expression]
        );
        if (notesResult.length > 0) {
            const notes = mapSqlResultToTypedArray<NotesTable>(
                notesResult[0],
                notesTableTransform
            );
            result.notes = notes.map((note) => note.note);
        }

        const sentencesResult = this.storageDrive.exec(
            "select * from " +
                Tables.SENTENCE +
                " INDEXED BY sentence_expression_index where expression = ?",
            [exprs.expression]
        );
        if (sentencesResult.length > 0) {
            result.sentences = mapSqlResultToTypedArray<SentencesTable>(
                sentencesResult[0],
                sentencesTableTransform
            );
        }

        const connectionsResult = this.storageDrive.exec(
            "select * from " +
                Tables.CONNECTIONS +
                " INDEXED BY connection_expression_index where expression = ?",
            [exprs.expression]
        );
        if (connectionsResult.length > 0) {
            const connections = mapSqlResultToTypedArray<ConnectionsTable>(
                connectionsResult[0],
                connectionsTableTransform
            );
            result.connections = connections.map(
                (connection) => connection.connection
            );
        }

        return result;
    }

    async getExpressionAfter(time: string): Promise<ReviewWord[]> {
        const unixStamp = moment.utc(time).unix();
        const expressionResult = this.storageDrive.exec(
            "select * from " +
                Tables.EXPRESSION +
                " INDEXED BY status_index where status > 0 date > ? order by date asc",
            [unixStamp]
        );
        if (expressionResult.length <= 0) {
            return [];
        }

        const expressions = mapSqlResultToTypedArray<ExpressionsTable>(
            expressionResult[0],
            expressionsTableTransform
        );

        const res: ReviewWord[] = [];
        for (const expr of expressions) {
            const sentencesResult = this.storageDrive.exec(
                "select * from " +
                    Tables.SENTENCE +
                    " INDEXED BY sentence_expression_index where expression = ?",
                [expr.expression]
            );
            const sentences = mapSqlResultToTypedArray<SentencesTable>(
                sentencesResult[0],
                sentencesTableTransform
            );

            sentences.forEach((sentence) => {
                res.push({
                    title: expr.expression,
                    expression: sentence.sentence.replace(
                        expr.expression,
                        `==${expr.expression}==`
                    ),
                    meaning: sentence.trans,
                    status: expr.status,
                    t: WordType.PHRASE,
                    notes: [],
                    sentences: [],
                    tags: expr.tags,
                });
            });

            const notesResult = this.storageDrive.exec(
                "select * from " +
                    Tables.NOTES +
                    " INDEXED BY note_expression_index where expression = ?",
                [expr.expression]
            );
            const notes = mapSqlResultToTypedArray<NotesTable>(
                notesResult[0],
                notesTableTransform
            );

            const tagsResult = this.storageDrive.exec(
                "select * from " +
                    Tables.TAGS +
                    " INDEXED BY tag_expression_index where expression = ?",
                [expr.expression]
            );
            const tags = mapSqlResultToTypedArray<TagsTable>(
                tagsResult[0],
                tagsTableTransform
            );

            res.push({
                title: expr.expression,
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: notes.map((note) => note.note),
                sentences,
                tags: tags.map((tag) => tag.tag),
            });
        }

        return res;
    }

    async getExpressionsSimple(
        expressions: string[]
    ): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map((e) => e.toLowerCase());

        const expressionResult = this.storageDrive.exec(
            "select * from " +
                Tables.EXPRESSION +
                " INDEXED BY expression_index where expression in (" +
                expressions.map((e) => "?").join(",") +
                ")",
            expressions
        );
        if (expressionResult.length > 0) {
            const exprs = mapSqlResultToTypedArray<ExpressionsTable>(
                expressionResult[0],
                expressionsTableTransform
            );
            return exprs.map((v) => {
                const sentencesResult = this.storageDrive.exec(
                    "select count(_id) from " +
                        Tables.SENTENCE +
                        " INDEXED BY sentence_expression_index where expression = ?",
                    [v.expression]
                );
                const sentencesCount =
                    sentencesResult.length > 0
                        ? Number(sentencesResult[0].values[0][0])
                        : 0;

                const tagsResult = this.storageDrive.exec(
                    "select count(_id) from " +
                        Tables.TAGS +
                        " INDEXED BY tag_expression_index where expression = ?",
                    [v.expression]
                );
                const tags = mapSqlResultToTypedArray<TagsTable>(
                    tagsResult[0],
                    tagsTableTransform
                );

                const notesResult = this.storageDrive.exec(
                    "select count(_id) from " +
                        Tables.NOTES +
                        " INDEXED BY note_expression_index where expression = ?",
                    [v.expression]
                );
                const notesCount =
                    notesResult.length > 0
                        ? Number(notesResult[0].values[0][0])
                        : 0;

                return {
                    expression: v.expression,
                    meaning: v.meaning,
                    status: v.status,
                    t: v.t,
                    tags: tags.map((tag) => tag.tag),
                    sen_num: sentencesCount,
                    note_num: notesCount,
                    date: v.date,
                };
            });
        }

        return Promise.resolve([]);
    }

    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        const expressions = payload.words.map((e) => e.toLowerCase());

        const storedPhrases = new Map<string, number>();
        const phrasesResult = this.storageDrive.exec(
            "select * from " +
                Tables.EXPRESSION +
                " INDEXED BY t_index where t = 'PHRASE'"
        );
        if (phrasesResult.length > 0) {
            const phrases = mapSqlResultToTypedArray<ExpressionsTable>(
                phrasesResult[0],
                expressionsTableTransform
            );
            phrases.forEach((phrase) => {
                storedPhrases.set(phrase.expression, phrase.status);
            });
        }

        const storedWords: Word[] = [];
        const expressionResult = this.storageDrive.exec(
            "select * from " +
                Tables.EXPRESSION +
                " INDEXED BY t_index where t = 'WORD' and  expression in (" +
                expressions.map((e) => "?").join(",") +
                ")",
            expressions
        );
        if (expressionResult.length > 0) {
            const expressions = mapSqlResultToTypedArray<ExpressionsTable>(
                expressionResult[0],
                expressionsTableTransform
            );
            expressions.forEach((expr) => {
                storedWords.push({
                    text: expr.expression,
                    status: expr.status,
                });
            });
        }

        const ac = await createAutomaton([...storedPhrases.keys()]);
        const searchedPhrases = (await ac.search(payload.article)).map(
            (match) => {
                return {
                    text: match[1],
                    status: storedPhrases.get(match[1]),
                    offset: match[0],
                } as Phrase;
            }
        );

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getTags(): Promise<string[]> {
        const tagsResult = this.storageDrive.exec(
            "select * from " + Tables.TAGS + " group by tag",
            []
        );
        if (tagsResult.length > 0) {
            return mapSqlResultToTypedArray<TagsTable>(
                tagsResult[0],
                tagsTableTransform
            ).map((tag) => {
                return tag.tag;
            });
        }

        return [];
    }

    async importDB(file: File, format: 'json' | 'csv' | 'sqlite3'): Promise<void> {
        try {
            if (format === 'sqlite3') {
                await this.importFromSQLite3File(file);
            } else if (format === 'json') {
                await this.importFromJSON(file);
            } else if (format === 'csv') {
                await this.importFromCSV(file);
            }
        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }

    /**
     * Import from SQLite3 database file
     * Reads the external SQLite3 database and copies all data to current database
     */
    private async importFromSQLite3File(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    const uint8Array = new Uint8Array(arrayBuffer);

                    // Create a temporary database from the imported file
                    const tempDB = new this.sqlJs.Database(uint8Array);

                    // Get all data from temp database
                    const importedData = await this.extractAllDataFromDB(tempDB);

                    // Close temp database
                    tempDB.close();

                    // Insert all data into current database
                    await this.bulkInsertData(importedData);

                    // Export to file
                    this.exportDbToFile();

                    resolve();
                } catch (error) {
                    console.error('Failed to import SQLite3 file:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Import from JSON file
     * Expected JSON format: Array of ExpressionInfo objects
     */
    private async importFromJSON(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const jsonContent = reader.result as string;
                    const data = JSON.parse(jsonContent);

                    // Validate and transform data
                    const expressions = this.validateAndTransformJSONData(data);

                    // Insert all data
                    await this.bulkInsertExpressions(expressions);

                    // Export to file
                    this.exportDbToFile();

                    resolve();
                } catch (error) {
                    console.error('Failed to import JSON file:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Import from CSV file
     * Expected CSV format: Expression,Meaning,Status,Type,Tags,Date
     */
    private async importFromCSV(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const csvContent = reader.result as string;
                    const expressions = this.parseCSVData(csvContent);

                    // Insert all data
                    await this.bulkInsertExpressions(expressions);

                    // Export to file
                    this.exportDbToFile();

                    resolve();
                } catch (error) {
                    console.error('Failed to import CSV file:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Extract all data from a database instance
     */
    private async extractAllDataFromDB(db: Database): Promise<ExpressionInfo[]> {
        const expressions: ExpressionInfo[] = [];

        // Get all expressions
        const exprsResult = db.exec("SELECT * FROM expressions");
        if (exprsResult.length > 0) {
            const exprs = mapSqlResultToTypedArray<ExpressionsTable>(
                exprsResult[0],
                expressionsTableTransform
            );

            for (const expr of exprs) {
                const expressionInfo: ExpressionInfo = {
                    expression: expr.expression,
                    meaning: expr.meaning,
                    status: expr.status,
                    t: expr.t,
                    tags: [],
                    notes: [],
                    sentences: [],
                    connections: [],
                    date: expr.date,
                };

                // Get tags for this expression
                const tagsResult = db.exec(
                    "SELECT tag FROM tags WHERE expression = ?",
                    [expr.expression]
                );
                if (tagsResult.length > 0) {
                    expressionInfo.tags = tagsResult[0].values.map((row: any[]) => row[0]);
                }

                // Get notes for this expression
                const notesResult = db.exec(
                    "SELECT note FROM notes WHERE expression = ?",
                    [expr.expression]
                );
                if (notesResult.length > 0) {
                    expressionInfo.notes = notesResult[0].values.map((row: any[]) => row[0]);
                }

                // Get sentences for this expression
                const sentencesResult = db.exec(
                    "SELECT sentence, trans, origin FROM sentences WHERE expression = ?",
                    [expr.expression]
                );
                if (sentencesResult.length > 0) {
                    expressionInfo.sentences = sentencesResult[0].values.map((row: any[]) => ({
                        sentence: row[0],
                        trans: row[1] || '',
                        origin: row[2] || '',
                        expression: expr.expression,
                    }));
                }

                // Get connections for this expression
                const connsResult = db.exec(
                    "SELECT connection FROM connections WHERE expression = ?",
                    [expr.expression]
                );
                if (connsResult.length > 0) {
                    expressionInfo.connections = connsResult[0].values.map((row: any[]) => row[0]);
                }

                expressions.push(expressionInfo);
            }
        }

        return expressions;
    }

    /**
     * Validate and transform JSON data
     */
    private validateAndTransformJSONData(data: any): ExpressionInfo[] {
        const expressions: ExpressionInfo[] = [];

        // Handle array format
        if (Array.isArray(data)) {
            for (const item of data) {
                const expr = this.validateExpressionInfo(item);
                if (expr) {
                    expressions.push(expr);
                }
            }
        }
        // Handle object with data property
        else if (data.data && Array.isArray(data.data)) {
            for (const item of data.data) {
                const expr = this.validateExpressionInfo(item);
                if (expr) {
                    expressions.push(expr);
                }
            }
        }

        return expressions;
    }

    /**
     * Validate a single ExpressionInfo object
     */
    private validateExpressionInfo(item: any): ExpressionInfo | null {
        if (!item || typeof item !== 'object') {
            return null;
        }

        // Required fields
        const expression = item.expression || item.Expression;
        if (!expression || typeof expression !== 'string') {
            console.warn('Invalid expression item: missing or invalid expression field', item);
            return null;
        }

        return {
            expression: expression.trim(),
            meaning: (item.meaning || item.Meaning || '')?.toString().trim() || '',
            status: parseInt(item.status || item.Status || '0'),
            t: (item.t || item.Type || 'WORD')?.toString().toUpperCase() || 'WORD',
            tags: Array.isArray(item.tags) ? item.tags : [],
            notes: Array.isArray(item.notes) ? item.notes : [],
            sentences: Array.isArray(item.sentences) ? item.sentences : [],
            connections: Array.isArray(item.connections) ? item.connections : [],
            date: item.date || moment().format("YYYY-MM-DD HH:mm:ss"),
        };
    }

    /**
     * Parse CSV data
     * Expected format: Expression,Meaning,Status,Type,Tags,Date
     */
    private parseCSVData(csvContent: string): ExpressionInfo[] {
        const expressions: ExpressionInfo[] = [];
        const lines = csvContent.split('\n');

        // Skip header if present
        let startIndex = 0;
        if (lines.length > 0 && lines[0].toLowerCase().includes('expression')) {
            startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                // Parse CSV line (handle quoted strings)
                const values = this.parseCSVLine(line);

                if (values.length >= 1 && values[0]) {
                    const expr: ExpressionInfo = {
                        expression: values[0]?.trim() || '',
                        meaning: values[1]?.trim() || '',
                        status: parseInt(values[2]) || 0,
                        t: values[3]?.trim().toUpperCase() || 'WORD',
                        tags: values[4] ? values[4].split(',').map(t => t.trim()).filter(t => t) : [],
                        notes: [],
                        sentences: [],
                        connections: [],
                        date: values[5] ? moment(values[5]).format("YYYY-MM-DD HH:mm:ss") : moment().format("YYYY-MM-DD HH:mm:ss"),
                    };

                    if (expr.expression) {
                        expressions.push(expr);
                    }
                }
            } catch (error) {
                console.warn(`Failed to parse CSV line ${i + 1}:`, line, error);
            }
        }

        return expressions;
    }

    /**
     * Parse a single CSV line, handling quoted strings
     */
    private parseCSVLine(line: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++;
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        values.push(current);

        return values;
    }

    /**
     * Bulk insert expressions into database
     */
    private async bulkInsertData(expressions: ExpressionInfo[]): Promise<void> {
        const BATCH_SIZE = 100;

        for (let i = 0; i < expressions.length; i += BATCH_SIZE) {
            const batch = expressions.slice(i, i + BATCH_SIZE);
            await this.bulkInsertExpressions(batch);
        }
    }

    /**
     * Bulk insert expressions using transactions
     */
    private async bulkInsertExpressions(expressions: ExpressionInfo[]): Promise<void> {
        try {
            // Begin transaction
            this.storageDrive.run('BEGIN TRANSACTION');

            for (const expr of expressions) {
                await this.postExpression(expr);
            }

            // Commit transaction
            this.storageDrive.run('COMMIT');
        } catch (error) {
            // Rollback on error
            this.storageDrive.run('ROLLBACK');
            throw error;
        }
    }

    postExpression(payload: ExpressionInfo): Promise<number> {
        const date = moment().format("YYYY-MM-DD HH:mm:ss");

        for (const sen of payload.sentences) {
            const senExistsResult = this.storageDrive.exec(
                "select _id from " +
                    Tables.SENTENCE +
                    " INDEXED BY sentence_expression_index where expression = ? and sentence = ? limit 1",
                [payload.expression, sen.sentence]
            );
            const senId =
                senExistsResult.length > 0
                    ? Number(senExistsResult[0].values[0][0])
                    : 0;
            if (senId) {
                this.storageDrive.exec(
                    "update " +
                        Tables.SENTENCE +
                        " set sentence = ?, trans = ?, origin = ?, date = ? where _id = ?",
                    [sen.sentence, sen.trans, sen.origin, date, senId]
                );
            } else {
                this.storageDrive.exec(
                    "insert into " +
                        Tables.SENTENCE +
                        " (expression, sentence, trans, origin) values (?, ?, ?, ?)",
                    [payload.expression, sen.sentence, sen.trans, sen.origin]
                );
            }
        }

        for (const tag of payload.tags) {
            const tagExistsResult = this.storageDrive.exec(
                "select _id from " +
                    Tables.TAGS +
                    " INDEXED BY tag_expression_index where expression = ? and tag = ? limit 1",
                [payload.expression, tag]
            );
            const tagId =
                tagExistsResult.length > 0
                    ? Number(tagExistsResult[0].values[0][0])
                    : 0;
            if (tagId) {
                this.storageDrive.exec(
                    "update " +
                        Tables.TAGS +
                        " set tag = ?, date = ? where _id = ?",
                    [tag, date, tagId]
                );
            } else {
                this.storageDrive.exec(
                    "insert into " +
                        Tables.TAGS +
                        " (expression, tag) values (?, ?)",
                    [payload.expression, tag]
                );
            }
        }

        for (const note of payload.notes) {
            const noteExistsResult = this.storageDrive.exec(
                "select _id from " +
                    Tables.NOTES +
                    " INDEXED BY note_expression_index where expression = ? and note = ? limit 1",
                [payload.expression, note]
            );
            const noteId =
                noteExistsResult.length > 0
                    ? Number(noteExistsResult[0].values[0][0])
                    : 0;
            if (noteId) {
                this.storageDrive.exec(
                    "update " +
                        Tables.NOTES +
                        " set note = ?, date = ? where _id = ?",
                    [note, date, noteId]
                );
            } else {
                this.storageDrive.exec(
                    "insert into " +
                        Tables.NOTES +
                        " (expression, note) values (?, ?)",
                    [payload.expression, note]
                );
            }
        }

        for (const conn of payload.connections) {
            const connExistsResult = this.storageDrive.exec(
                "select _id from " +
                    Tables.CONNECTIONS +
                    " INDEXED BY connection_expression_index where expression = ? and connection = ? limit 1",
                [payload.expression, conn]
            );
            const connId =
                connExistsResult.length > 0
                    ? Number(connExistsResult[0].values[0][0])
                    : 0;
            if (connId) {
                this.storageDrive.exec(
                    "update " +
                        Tables.CONNECTIONS +
                        " set connection = ?, date = ? where _id = ?",
                    [conn, date, connId]
                );
            } else {
                this.storageDrive.exec(
                    "insert into " +
                        Tables.CONNECTIONS +
                        " (expression, connection) values (?, ?)",
                    [payload.expression, conn]
                );
            }
        }

        const existsResult = this.storageDrive.exec(
            "select _id from " +
                Tables.EXPRESSION +
                " where expression = ? limit 1",
            [payload.expression]
        );
        const id =
            existsResult.length > 0 ? Number(existsResult[0].values[0][0]) : 0;
        if (id) {
            this.storageDrive.exec(
                "update " +
                    Tables.EXPRESSION +
                    " set expression = ?, meaning = ?, status = ?, t = ?, date = ? where _id = ?",
                [
                    payload.expression,
                    payload.meaning,
                    payload.status,
                    payload.t,
                    date,
                    id,
                ]
            );
        } else {
            this.storageDrive.exec(
                "insert into " +
                    Tables.EXPRESSION +
                    " (expression, meaning, status, t, date) values (?, ?, ?, ?, ?)",
                [
                    payload.expression,
                    payload.meaning,
                    payload.status,
                    payload.t,
                    date,
                ]
            );
        }

        this.exportDbToFile();

        return Promise.resolve(200);
    }

    async postIgnoreWords(payload: string[]): Promise<void> {
        const promises: Promise<void>[] = [];
        const dataSet = new Set(
            payload.map((word) => word.trim().toLowerCase())
        );

        // 去重复后再添加，转义单引号避免 SQL 语法错误
        const expressions: string[] = [...dataSet].map((word) => {
            // 将单引号转义为两个单引号（SQL 标准转义方式）
            const escapedWord = word.replace(/'/g, "''");
            return `('${escapedWord}', '', 0, '${WordType.WORD}')`;
        });

        // 触发每批 100 条的添加
        for (let i = 0; i < expressions.length; i += 100) {
            promises.push(
                new Promise((resolve, reject) => {
                    try {
                        const batchValues = expressions
                            .slice(i, i + 100)
                            .join(",");
                        this.storageDrive.exec(
                            `insert into ${Tables.EXPRESSION} (expression, meaning, status, t) values ${batchValues}`
                        );
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                })
            );
        }

        // 存储
        Promise.all(promises).finally(() => {
            if (promises.length > 0) {
                this.exportDbToFile();
            }
        });
    }

    async removeExpression(expression: string): Promise<boolean> {
        const expressionResult = this.storageDrive.exec(
            "delete from " + Tables.EXPRESSION + " where expression = ?",
            [expression]
        );
        const sentenceResult = this.storageDrive.exec(
            "delete from " + Tables.SENTENCE + " where expression = ?",
            [expression]
        );
        const tagsResult = this.storageDrive.exec(
            "delete from " + Tables.TAGS + " where expression = ?",
            [expression]
        );
        const notesResult = this.storageDrive.exec(
            "delete from " + Tables.NOTES + " where expression = ?",
            [expression]
        );
        const connResult = this.storageDrive.exec(
            "delete from " + Tables.CONNECTIONS + " where expression = ?",
            [expression]
        );

        const state =
            expressionResult.length > 0 &&
            sentenceResult.length > 0 &&
            tagsResult.length > 0 &&
            notesResult.length > 0 &&
            connResult.length > 0;

        return Promise.resolve(state).finally(() => this.exportDbToFile());
    }

    async tryGetSen(text: string): Promise<Sentence> {
        const sentenceResult = this.storageDrive.exec(
            "select * from " + Tables.SENTENCE + " where sentence = ?",
            [text]
        );

        if (sentenceResult.length > 0) {
            const sentence = mapSqlResultToTypedObject<Sentence>(
                sentenceResult[0],
                sentencesTableTransform
            );
            return {
                ...sentence,
            };
        }

        return null;
    }
}
