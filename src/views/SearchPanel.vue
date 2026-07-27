<template>
    <div id="langr-search" @click="handleClick">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig">
            <div class="search-bar" style="display:flex;">
                <NButtonGroup size="tiny">
                    <NButton :disabled="historyIndex <= 0" @click="switchHistory('prev')">{{ `<` }} </NButton>
                            <NButton :disabled="historyIndex >= lastHistory" @click="switchHistory('next')">{{ ">" }}
                            </NButton>
                </NButtonGroup>
                <NInput size="tiny" type="text" placeholder="输入单词" v-model:value="inputWord" style="flex:1;"
                    @keydown.enter="handleSearch" />
                <NButton size="tiny" @click="handleSearch" style="margin-left:5px;">{{ t("Search") }}</NButton>
            </div>
            <!-- 词形还原提示（与 LearnPanel 联动） -->
            <div v-if="lemmaToggle" class="lemma-hint">
                <span class="lemma-original">原文: {{ lemmaToggle.original }}</span>
                <NButton size="tiny" tertiary type="primary" @click="toggleLemma">
                    {{
                        (word || '').toLowerCase() === lemmaToggle.lemma
                            ? '↩ 改回原文'
                            : '↩ 改回原型'
                    }}
                </NButton>
            </div>
        </NConfigProvider>
        <div class="dict-area" style="overflow:auto;">
            <DictItem v-for="(cp, i) in components" :loading="loadings[i]" :name="cp.name" :id="cp.id">
                <KeepAlive>
                    <Component @loading="loading" :is="cp.type" :word="word" v-show="shows[i]"></Component>
                </KeepAlive>
            </DictItem>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance } from "vue";
import { NConfigProvider, NButton, NButtonGroup, NInput, darkTheme, GlobalThemeOverrides } from "naive-ui";

import DictItem from "./DictItem.vue";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import { dicts } from "@dict/list";
import { playAudio } from "@/utils/helpers";
import { lookupLemmaViaCambridge } from "@/utils/lookupLemma";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const themeConfig: GlobalThemeOverrides = {

};

let components = ref([]);
let map: { [K in string]: number } = {};
let loadings = ref<boolean[]>([]);
let shows = ref<boolean[]>([]);
watch(() => plugin.store.dictsChange, () => {
    let collection = Object.keys(plugin.settings.dictionaries)
        .map((dict: keyof typeof dicts) => {
            return {
                id: dict,
                priority: plugin.settings.dictionaries[dict].priority,
                name: dicts[dict].name,
            };
        })
        .filter((dict) => plugin.settings.dictionaries[dict.id].enable);
    collection.sort((a, b) => a.priority - b.priority);

    components.value = collection.map((dict) => {
        return {
            id: dict.id,
            name: dict.name,
            type: dicts[dict.id].Cp,
        };
    });
    collection.forEach((v, i) => {
        map[v.id] = i;
    });
    loadings.value = Array(collection.length).fill(false);
    shows.value = Array(collection.length).fill(false);

}, {
    immediate: true
});

function loading({ id, loading, result }: { id: string, loading: boolean, result: boolean; }) {
    loadings.value[map[id]] = loading;
    shows.value[map[id]] = result;
}

// 切换明亮/黑暗模式
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});

// 提供一个前进后退查询记录的功能
let history: string[] = [];
let lastHistory = ref(history.length - 1);
let historyIndex = ref(-1);
function switchHistory(direction: "prev" | "next") {
    historyIndex.value = Math.max(
        0,
        Math.min(historyIndex.value + (direction === "prev" ? -1 : 1), history.length - 1)
    );
    word.value = history[historyIndex.value];
    inputWord.value = history[historyIndex.value];
    // 历史回放：没有足够上下文知道当时是否有 lemma 切换，保守清空
    lemmaToggle.value = null;
}
function appendHistory() {
    if (historyIndex.value < history.length - 1) {
        history = history.slice(0, historyIndex.value + 1);
    }
    history.push(word.value);
    lastHistory.value = history.length - 1;
    historyIndex.value++;
}

let inputWord = ref("");
let word = ref("");

// 词形还原状态 — 与 LearnPanel 通过 obsidian-langr-lemma-toggle 事件联动
let lemmaToggle = ref<{ original: string; lemma: string } | null>(null);

const onSearch = async (evt: CustomEvent) => {
    let text = (evt.detail.selection || "") as string;
    // 从阅读区查词触发时，应用词形还原（与 LearnPanel 行为一致）
    await applyLookupLemma(text);
    appendHistory();
};

function handleSearch() {
    // 用户手动按 Enter / Search — 不做自动还原（保留用户输入的原样）
    // 但如果之前有 lemma 切换（例如从阅读区点过来的），用户主动搜索说明他想要别的，清空
    word.value = inputWord.value;
    lemmaToggle.value = null;
    appendHistory();
}

function handleClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;
    if (target.hasClass("speaker")) {
        evt.preventDefault();
        evt.stopPropagation();
        let url = (target as HTMLAnchorElement).href;
        playAudio(url);

    }
    else if (target.tagName === "A") {
        evt.preventDefault();
        evt.stopPropagation();
        // 点击词典结果里的链接：用户明确想看那个词，不做还原
        const text = (target.textContent || "").trim();
        word.value = text;
        inputWord.value = text;
        lemmaToggle.value = null;
        appendHistory();
    }
}

/**
 * 应用查词触发的词形还原（仅对单词生效，短语保留原样）
 * - 发生还原：存 { original, lemma }，把 word/inputWord 设为 lemma（词典去查原型）
 * - 未还原：清空 lemmaToggle
 * - 走剑桥词典 API：变形词搜索时剑桥会自动重定向到原型词条，
 *   返回的 html 里 .headword 就是原型
 */
async function applyLookupLemma(text: string) {
    if (text && !/\s/.test(text.trim())) {
        const lemma = await lookupLemmaViaCambridge(text);
        if (lemma && lemma.toLowerCase() !== text.toLowerCase()) {
            lemmaToggle.value = { original: text, lemma };
            word.value = lemma;
            inputWord.value = lemma;
            return;
        }
    }
    lemmaToggle.value = null;
    word.value = text;
    inputWord.value = text;
}

/**
 * 切换原文 / 原型，同时通知 LearnPanel 一起变
 */
function toggleLemma() {
    if (!lemmaToggle.value) return;
    const { original, lemma } = lemmaToggle.value;
    const current = (word.value || "").toLowerCase();
    const target = current === lemma ? original : lemma;
    word.value = target;
    inputWord.value = target;
    // 通知另一面板
    dispatchEvent(new CustomEvent("obsidian-langr-lemma-toggle", {
        detail: { source: "search", word: target, original, lemma },
    }));
}

/**
 * 监听 LearnPanel 的切换事件 — 同步更新这边的 word/inputWord
 */
const onLemmaToggleFromLearn = (evt: CustomEvent) => {
    if (!evt || !evt.detail || evt.detail.source === "search") return;
    const { word: newWord, original, lemma } = evt.detail as {
        source: string; word: string; original: string; lemma: string;
    };
    if (!newWord) return;
    word.value = newWord;
    inputWord.value = newWord;
    lemmaToggle.value = { original, lemma };
};


onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch);
    addEventListener('obsidian-langr-lemma-toggle', onLemmaToggleFromLearn);
});

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch);
    removeEventListener('obsidian-langr-lemma-toggle', onLemmaToggleFromLearn);
});
</script>

<style lang="scss">
#langr-search {
    height: 100%;
    width: 100%;
    overflow: hidden;
    font-size: 0.8em;
    user-select: text;
    display: flex;
    flex-direction: column;

    .search-bar {
        margin-bottom: 5px;

        button {
            margin-right: 5px;
        }
    }

    .lemma-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-muted);
        padding: 2px 4px 4px 4px;

        .lemma-original {
            font-style: italic;
        }
    }

    .dict-area {
        flex: 1;
    }
}

.is-mobile #langr-search {
    button:not(.fold-mask) {
        width: auto;
    }

    input[type='text'] {
        padding: 0;
    }
}
</style>