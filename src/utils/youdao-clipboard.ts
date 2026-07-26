/**
 * 有道查词结果：自动把"短句翻译"复制到剪贴板
 *
 * 原本是通过 main.js 末尾的 IIFE monkey patch 实现的（Hb = 你懂的 search 函数），
 * 现在挪到源码里，build 时自动包含。
 *
 * 触发条件（避免误触发：只在"短句"场景下才复制，单词查词不复制）：
 * - 无换行
 * - 不含中文标点（。！？；）
 * - 长度 ≤ 60
 * - 单词数 1-8
 *
 * 提取顺序：result.basic → result.translation
 * 提取算法：先找 <li>，再找 <p>（超过 200 字或含"机器翻译"则放弃），最后 <span>。
 */

/**
 * 从一段 HTML 字符串中抽取出"干净"的纯文本翻译
 * - 优先从 <li> 抽取
 * - 然后 <p>（超长或含"机器翻译"则放弃）
 * - 然后 <span>
 * - 最后退回全部 textContent
 */
export function extractCleanText(html: string): string {
    if (!html || typeof document === "undefined") return "";
    const t = document.createElement("div");
    t.innerHTML = html;

    // 1) <li> 列表 — 有道翻译常把每个义项放 <li> 里
    const liNodes = Array.from(t.querySelectorAll("li"));
    if (liNodes.length) {
        const texts = liNodes
            .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const seen = new Set<string>();
        const out: string[] = [];
        for (const s of texts) {
            if (!seen.has(s)) {
                seen.add(s);
                out.push(s);
            }
        }
        return out.join("\n");
    }

    // 2) <p> 段落
    const pNodes = Array.from(t.querySelectorAll("p"));
    let candidates = pNodes
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
    if (!candidates.length) {
        // 3) <span> fallback
        candidates = Array.from(t.querySelectorAll("span"))
            .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
            .filter(Boolean);
    }
    if (candidates.length) {
        const joined = candidates.join("\n");
        // 太长或带"机器翻译"标记 → 整段丢弃（避免把整页机器翻译塞进剪贴板）
        if (joined.length > 200 || /机器翻译|Machine Translation/i.test(joined)) {
            return "";
        }
        // 单条太长 → 也丢
        const seen = new Set<string>();
        const out: string[] = [];
        for (const s of candidates) {
            if (s.length > 80) continue;
            if (!seen.has(s)) {
                seen.add(s);
                out.push(s);
            }
        }
        return out.join("\n");
    }

    return (t.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * 判断一段查询文本是不是"短句"（适合自动复制翻译到剪贴板的场景）
 */
export function isShortSentence(text: string): boolean {
    if (!text) return false;
    const t = text.trim();
    if (t.length === 0 || t.length > 60) return false;
    if (/\n/.test(t)) return false;
    if (/[。！？；]/.test(t)) return false;
    const words = t.split(/\s+/g).filter(Boolean);
    return words.length >= 1 && words.length <= 8;
}

/**
 * 异步写剪贴板（fail-safe）
 */
function writeClipboard(text: string): void {
    if (!text) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        }
    } catch (e) {
        // 静默失败 — 不打扰用户
    }
}

interface YoudaoSearchResultLike {
    result?: {
        basic?: string;
        translation?: string;
        [k: string]: any;
    };
    [k: string]: any;
}

/**
 * 主入口：查词完成后，若符合"短句"条件，从 result.basic / result.translation
 * 抽取翻译并写入剪贴板。
 */
export function maybeCopyTranslation(
    query: string,
    result: YoudaoSearchResultLike | null | undefined
): void {
    if (!isShortSentence(query)) return;
    if (!result || !result.result) return;
    let text = "";
    if (result.result.basic) {
        text = extractCleanText(result.result.basic);
    }
    if (!text && result.result.translation) {
        text = extractCleanText(result.result.translation);
    }
    if (text) writeClipboard(text);
}
