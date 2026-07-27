/**
 * 调剑桥词典拿原型 (headword / base form)
 *
 * 返回 null 的场景：
 *   - 短语（含空白）
 *   - 拼写完全错（剑桥返回 "No results" / 相关词）
 *   - 网络/解析失败
 */
import { search as cambridgeSearch } from "@dict/cambridge/engine";

export async function lookupLemmaViaCambridge(text: string): Promise<string | null> {
    if (!text) return null;
    try {
        const result = await cambridgeSearch(text);
        if (!result || !result.result || result.result.length === 0) return null;
        const firstHtml = result.result[0].html as string;
        if (!firstHtml) return null;
        // 用 DOMParser 解析 HTML 找 .headword
        const parser = new DOMParser();
        const doc = parser.parseFromString(firstHtml, 'text/html');
        const headword = doc.querySelector('.headword');
        if (headword) {
            const lemma = (headword.textContent || '').trim();
            return lemma || null;
        }
    } catch (e) {
        console.error('Cambridge lookup failed:', e);
    }
    return null;
}
