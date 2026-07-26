/**
 * 词形还原 (lemma restoration) — 从外刊阅读工具移植过来
 *
 * 用途：阅读时点击 ran/children/went 这种变形词，自动还原成 run/child/go 后再添加到生词本。
 * 优先级：有道翻译括号里的提示 > 不规则词典 > 规则后缀还原
 * 设计原则：保守优先，宁可漏改也不瞎改（避免把 researcher/computer 之类的词误判）
 */

const IRREGULAR_FORMS: Record<string, string> = {
    // 不规则复数（最常考）
    children: 'child', men: 'man', women: 'woman', people: 'person',
    feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
    oxen: 'ox', lice: 'louse', dice: 'die',
    // -f/-fe → -ves 复数
    wolves: 'wolf', knives: 'knife', leaves: 'leaf', wives: 'wife',
    lives: 'life', halves: 'half', shelves: 'shelf', thieves: 'thief',
    loaves: 'loaf', calves: 'calf', elves: 'elf',
    // 不规则动词过去式 / 过去分词
    ran: 'run', went: 'go', came: 'come', took: 'take',
    given: 'give', taken: 'take', seen: 'see', done: 'do', made: 'make',
    said: 'say', thought: 'think', found: 'find', brought: 'bring',
    bought: 'buy', taught: 'teach', caught: 'catch', fought: 'fight',
    sought: 'seek', broke: 'break', spoke: 'speak', wrote: 'write',
    drove: 'drive', gave: 'give', knew: 'know', grew: 'grow',
    drew: 'draw', flew: 'fly', threw: 'throw', blew: 'blow',
    chose: 'choose', woke: 'wake', wore: 'wear', tore: 'tear',
    bore: 'bear', swore: 'swear', hid: 'hide', bit: 'bite', ate: 'eat',
    fell: 'fall', led: 'lead', met: 'meet', paid: 'pay', sat: 'sit',
    left: 'leave', kept: 'keep', slept: 'sleep', felt: 'feel',
    sent: 'send', spent: 'spend', lent: 'lend', built: 'build',
    lost: 'lose', won: 'win', hung: 'hang', sold: 'sell', told: 'tell',
    held: 'hold', put: 'put', cut: 'cut', set: 'set', let: 'let',
    hit: 'hit', shut: 'shut', hurt: 'hurt', cost: 'cost', quit: 'quit',
    split: 'split', spread: 'spread', cast: 'cast', shed: 'shed',
    rid: 'rid', beat: 'beat', begun: 'begin', sung: 'sing',
    drunk: 'drink', rung: 'ring', sunk: 'sink', swum: 'swim',
    sprung: 'spring', stung: 'sting', swung: 'swing', clung: 'cling',
    flung: 'fling', slung: 'sling', strung: 'string',
    bound: 'bind', ground: 'grind', wound: 'wind',
    shrunk: 'shrink', shrank: 'shrink',
    // 常用 -en 过去分词（补全主表里没列的；重复项已经在上面）
    eaten: 'eat', fallen: 'fall', hidden: 'hide',
    ridden: 'ride', written: 'write', broken: 'break', spoken: 'speak',
    chosen: 'choose', frozen: 'freeze', stolen: 'steal', woven: 'weave',
    // be / have 变位
    am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
    has: 'have', had: 'have', having: 'have',
    // 不规则比较级 / 最高级
    better: 'good', best: 'good', worse: 'bad', worst: 'bad',
    further: 'far', furthest: 'far', farther: 'far', farthest: 'far',
};

/**
 * 规则变形的兜底 lemmatize
 * 只处理最常见的后缀规则，保守优先 — 宁可漏改也不瞎改
 */
function lemmatizeFallback(word: string): string {
    if (!word || word.length <= 3) return word;
    const w = word.toLowerCase();

    // 1) -ies → -y（cities → city；consonant + y 才适用）
    if (w.length > 4 && w.endsWith('ies')) {
        const cand = w.slice(0, -3) + 'y';
        if (/[bcdfghjklmnpqrstvwxz]y$/.test(cand)) return cand;
    }

    // 2) 复数 -s/-es（保守：避开 ss / us 结尾的词）
    if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && w.length > 3) {
        // 2a) 试 -es：只有当 base 看起来像 s/x/z/ch/sh 结尾才应用
        if (w.length > 4 && w.endsWith('es')) {
            const base = w.slice(0, -2);
            if (/(?:[sxz]|ch$|sh$)$/.test(base) && base.length >= 2) {
                return base;
            }
        }
        // 2b) 普通 -s（cats → cat, boys → boy, dogs → dog）
        const base = w.slice(0, -1);
        if (base.length >= 2) return base;
    }

    // 3) 过去式 / 过去分词 -ed
    if (w.length > 4 && w.endsWith('ed')) {
        // 3a) -ied → -y（tried → try, carried → carry）
        if (w.length >= 5 && w.endsWith('ied')) return w.slice(0, -3) + 'y';
        // 3b) 双写辅音 + ed（stopped → stop, planned → plan）
        if (w.length > 5
            && w[w.length - 3] === w[w.length - 4]
            && /[bcdfghjklmnpqrstvwxz]/.test(w[w.length - 3])) {
            return w.slice(0, -3);
        }
        // 3c) 普通 -ed（liked → like, walked → walk, hoped → hope）
        const base = w.slice(0, -2);
        if (base.length < 4 && /[bcdfghjklmnpqrstvwxz]/.test(base.slice(-1))) {
            return base + 'e';
        }
        return base;
    }

    // 4) 现在分词 -ing
    if (w.length > 5 && w.endsWith('ing')) {
        // 4a) 双写辅音 + ing（running → run, swimming → swim）
        if (w.length > 6
            && w[w.length - 4] === w[w.length - 5]
            && /[bcdfghjklmnpqrstvwxz]/.test(w[w.length - 4])) {
            return w.slice(0, -4);
        }
        // 4b) 去掉 -ing（going → go, talking → talk, making → make）
        const base = w.slice(0, -3);
        if (IRREGULAR_FORMS[base]) return IRREGULAR_FORMS[base];
        if (base.length >= 2) return base;
    }

    // 5) 形容词/副词最高级 -est
    if (w.length > 4 && w.endsWith('est')) {
        if (w.length > 5 && w.endsWith('iest')) return w.slice(0, -4) + 'y';
        if (w.length > 5
            && w[w.length - 4] === w[w.length - 5]
            && /[bcdfghjklmnpqrstvwxz]/.test(w[w.length - 4])) {
            return w.slice(0, -4);
        }
        return w.slice(0, -3);
    }

    // 6) 形容词/副词比较级 -er
    if (w.length > 3 && w.endsWith('er')) {
        if (w.length > 4 && w.endsWith('ier')) return w.slice(0, -3) + 'y';
        if (w.length > 4
            && w[w.length - 3] === w[w.length - 4]
            && /[bcdfghjklmnpqrstvwxz]/.test(w[w.length - 3])) {
            return w.slice(0, -3);
        }
        const base = w.slice(0, -2);
        if (IRREGULAR_FORMS[base]) return IRREGULAR_FORMS[base];
        if (base.length >= 2 && !/^(?:re|un|pre|dis|over|under|out|up)$/.test(base)) {
            return base;
        }
    }

    return w;
}

/**
 * 主入口：拿一个词的原型（lemma / base form）
 *
 * @param word 原始词（可能变形）
 * @returns 还原后的原型；如果没发生还原，返回原词（小写）
 */
export function getLemma(word: string): string {
    if (!word) return word;
    const w = word.toLowerCase();
    // 不规则词典
    if (IRREGULAR_FORMS[w] && IRREGULAR_FORMS[w] !== w) return IRREGULAR_FORMS[w];
    // 规则
    const fallback = lemmatizeFallback(w);
    return fallback !== w ? fallback : w;
}

/**
 * 便捷包装：返回是否发生了还原 + 原型
 * - { lemma: 'run', changed: true }   还原成功
 * - { lemma: 'apple', changed: false } 没还原（本来就是原型）
 */
export function tryLemmatize(word: string): { lemma: string; changed: boolean; original: string } {
    const original = (word || '').trim();
    if (!original) return { lemma: '', changed: false, original: '' };
    const lemma = getLemma(original);
    return { lemma, changed: lemma !== original.toLowerCase(), original };
}
