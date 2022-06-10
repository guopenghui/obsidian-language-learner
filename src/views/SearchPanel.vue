<template>
    <div class="container" @click="handleClick">
       <NConfigProvider :theme="theme">
            <div class="search-bar" style="display:flex;">
                <NInput type="text" placeholder="输入单词" v-model:value="inputWord" style="flex:1;" @keydown.enter="word = inputWord"/>
                <NButton @click="word = inputWord" style="margin-left:5px;">{{ t("Search") }}</NButton>
            </div>
        </NConfigProvider> 
        <KeepAlive>
            <Component :is="Youdao" :word="word"></Component>
        </KeepAlive>
    </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onUnmounted} from "vue"
import {NConfigProvider, NButton, NInput, darkTheme} from "naive-ui"

import Youdao from "../dictionary/youdao/View.vue"
import {t} from "../lang/helper"


let theme = document.body.hasClass("theme-dark") ? darkTheme : null

let inputWord = ref("")
let word = ref("")
const onSearch = async (evt: CustomEvent) => {
    let text = evt.detail.selection
    word.value = text
}

function handleClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement
    if(target.tagName === "A") {
        evt.preventDefault()
        evt.stopPropagation()
        word.value = target.textContent
    }
}


onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch)
})

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch)
})
</script>