<template>
    <div class="container" @click="handleClick">
       <NConfigProvider :theme="theme">
            <div class="search-bar" style="display:flex;">
                <NButtonGroup size="small">
                    <NButton :disabled="historyIndex<=0" @click="switchHistory('prev')">{{`<`}}</NButton>
                    <NButton :disabled="historyIndex>=lastHistory" @click="switchHistory('next')">{{">"}}</NButton>
                </NButtonGroup> 
                <NInput size="small" type="text" placeholder="输入单词" v-model:value="inputWord" style="flex:1;" @keydown.enter="handleSearch"/>
                <NButton size="small" @click="handleSearch" style="margin-left:5px;">{{ t("Search") }}</NButton>
            </div>
        </NConfigProvider> 
        <KeepAlive>
            <Component :is="Youdao" :word="word"></Component>
        </KeepAlive>
    </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted} from "vue"
import {NConfigProvider, NButton, NButtonGroup, NInput, darkTheme} from "naive-ui"

import Youdao from "../dictionary/youdao/View.vue"
import {t} from "../lang/helper"
import store from "./store"

// 切换明亮/黑暗模式
const theme = computed(() => {
	return store.dark? darkTheme: null
})

// 提供一个前进后退查询记录的功能
let history: string[] = []
let lastHistory = ref(history.length-1)
let historyIndex = ref(-1)
function switchHistory(direction: "prev"|"next") {
    historyIndex.value = Math.max(
        0, 
        Math.min(historyIndex.value + (direction==="prev"?-1:1), history.length-1)
    )
    word.value = history[historyIndex.value]
}
function appendHistory() {
    if(historyIndex.value < history.length - 1) {
        history = history.slice(0, historyIndex.value+1)
    }
    history.push(word.value)
    lastHistory.value = history.length - 1
    historyIndex.value++
}

let inputWord = ref("")
let word = ref("")
const onSearch = async (evt: CustomEvent) => {
    let text = evt.detail.selection
    word.value = text
    appendHistory()
}

function handleSearch() {
    word.value = inputWord.value
    appendHistory()
}

function handleClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement
    if(target.tagName === "A") {
        evt.preventDefault()
        evt.stopPropagation()
        word.value = target.textContent
        appendHistory()
    }
}


onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch)
})

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch)
})
</script>