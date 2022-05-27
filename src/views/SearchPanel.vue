<template>
    <div class="container" ref="panel">
        <NConfigProvider :theme="theme">
            <div class="search-bar" style="display:flex;">
                <NInput type="text" placeholder="输入单词" v-model:value="word2" style="flex:1;" />
                <NButton @click="searchWord(word2)" style="margin-left:5px;">{{ t("Search") }}</NButton>
            </div>
        </NConfigProvider>
        <h2>{{ word2 }}</h2>
        <div class="pronunces">
            <span class="pron" v-for="i in prons.length" @click="play(i - 1)">{{ prons[i - 1].phsym }}</span>
        </div>
        <div ref="meaning2" style="margin-bottom: 10px;"></div>
        <button v-for="sub in ['柯林斯', '辨析', '例句', '句酷']" @click="curPanel = sub"
            :style="curPanel === sub ? 'background-color:#483699;color:white;' : ''">{{ sub }}</button>
        <Collins class="collins" v-if="curPanel === '柯林斯'" :mydata="collins" />
        <div class="diff" v-else-if="curPanel === '辨析'" v-html="discriminationHTML"></div>
        <div class="stn-examle" v-else-if="curPanel === '例句'" v-html="sentencesHTML"></div>
        <div class="jukuu"></div>
    </div>
</template>

<script setup lang="ts">
// import { Notice, requestUrl, RequestUrlParam } from 'obsidian'
import { getCurrentInstance, onMounted, onUnmounted, ref } from 'vue'
import { NInput, NButton, NConfigProvider, darkTheme } from "naive-ui"

// import Plugin from "../plugin"
import Collins from "./Collins.vue"
import { search, YoudaoResultLex } from "../web-dicts/youdao"
import { t } from "../lang/helper"

let theme = document.body.hasClass("theme-dark") ? darkTheme : null

function play(i: number) {
    (new Audio(prons.value[i].url)).play()
}

let word2 = ref("")
let meaning2 = ref(null)
let prons = ref([])
let curPanel = ref("柯林斯")
let collins = ref([{}])
let discriminationHTML = ref("")
let sentencesHTML = ref("")

async function searchWord(word: string) {
    let res = await search(word)
    if (!res) {
        return
    }
    let result = res.result as YoudaoResultLex
    meaning2.value.innerHTML = result.basic
    prons.value = result.prons
    collins.value = result.collins
    discriminationHTML.value = result.discrimination
    sentencesHTML.value = result.sentence
}

let panel = ref(null)
// const plugin: Plugin = getCurrentInstance().appContext.config.globalProperties.plugin
const onSearch = async (evt: CustomEvent) => {
    // evt.preventDefault()
    let word = evt.detail.selection
    await searchWord(word)
    word2.value = word
}

onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch)
})

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch)
})

</script>
