import {ConnectionsTable, ExpressionsTable, NotesTable, SentencesTable, TagsTable} from "@/storage/drive/types";
import {QueryExecResult} from "sql.js";

/**
 * 通用映射函数：将sql.js原始结果转换为强类型TS对象数组
 * @param sqlResult sql.js exec方法返回的单个结果（result[0]）
 * @param transform 可选：字段类型转换自定义函数（处理日期、布尔值等）
 * @returns 强类型对象数组
 */
export function mapSqlResultToTypedArray<T>(
    sqlResult: QueryExecResult,
    transform?: (item: Record<string, any>) => T
): T[] {
    const { columns, values } = sqlResult;
    if (!columns || !values || values.length === 0) {
        return [];
    }

    // 第一步：将 列名数组 + 数值二维数组 映射为 原始对象数组（key为列名，value为原始值）
    const rawObjects = values.map((valueRow) => {
        const rawObj: Record<string, any> = {};
        columns.forEach((colName, index) => {
            rawObj[colName] = valueRow[index];
        });
        return rawObj;
    });

    // 第二步：执行自定义类型转换（日期、布尔值等），返回强类型对象
    if (transform) {
        return rawObjects.map(transform);
    }

    return rawObjects as T[];
}

/**
 * 通用映射函数：将sql.js原始结果转换为单个强类型TS对象（适用于单条查询）
 * @param sqlResult sql.js exec方法返回的单个结果（result[0]）
 * @param transform 可选：字段类型转换自定义函数
 * @returns 单个强类型对象 | null
 */
export function mapSqlResultToTypedObject<T>(
    sqlResult: { columns: string[]; values: any[][] },
    transform?: (item: Record<string, any>) => T
): T | null {
    const typedArray = mapSqlResultToTypedArray(sqlResult, transform);
    return typedArray.length > 0 ? typedArray[0] : null;
}

export function expressionsTableTransform(
    rawObj: Record<string, any>,
): ExpressionsTable | null  {
    return {
        connections: [],
        date: rawObj.date,
        expression: rawObj.expression || "",
        meaning: rawObj.meaning || "",
        notes: [],
        sentences: undefined,
        status: rawObj.status,
        t: rawObj.t,
        tags: [],
        _id: rawObj._id
    }
}

export function tagsTableTransform(
    rawObj: Record<string, any>
): TagsTable | null {

    return {
        _id: rawObj?._id,
        expression: rawObj?.expression,
        tag: rawObj?.tag,
        date: rawObj?.date,
    }
}

export function notesTableTransform(
    rawObj: Record<string, any>  // 改为单个对象
): NotesTable | null {
    return {
        _id: rawObj?._id,
        expression: rawObj?.expression,
        note: rawObj?.note,
        date: rawObj?.date,
    }
}

export function sentencesTableTransform(
    rawObj: Record<string, any>  // 改为单个对象
): SentencesTable | null {
    return {
        _id: rawObj?._id,
        expression: rawObj?.expression,
        origin: rawObj?.origin,
        sentence: rawObj?.sentence,
        trans: rawObj?.trans,
        date: rawObj?.date,
    }
}

export function connectionsTableTransform(
    rawObj: Record<string, any>  // 改为单个对象
): ConnectionsTable | null {
    return {
        _id: rawObj?._id,
        expression: rawObj?.expression,
        connection: rawObj?.connection,
        date: rawObj?.date,
    }
}
