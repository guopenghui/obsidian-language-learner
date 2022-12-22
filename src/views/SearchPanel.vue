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
const onSearch = async (evt: CustomEvent) => {
    let text = evt.detail.selection;
    word.value = text;
    appendHistory();
};

function handleSearch() {
    word.value = inputWord.value;
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
        word.value = target.textContent;
        inputWord.value = target.textContent;
        appendHistory();
    }
}


onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch);
});

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch);
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