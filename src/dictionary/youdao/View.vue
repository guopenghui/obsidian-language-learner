<template>
    <div class="container">
        <h2>{{ word }}</h2>
        <div class="pronunces">
            <span class="pron" v-for="i in prons.length" @click="play(i - 1)">{{ prons[i - 1].phsym }}</span>
        </div>
        <div style="margin-bottom: 10px;" v-html="meaningHTML"></div>
        <div class="translation" v-html="translationHTML"/>
        <button v-for="sub in ['柯林斯', '辨析', '词组', '同根词']" 
            @click="curPanel = sub"
            :style="curPanel === sub ? 'background-color:#483699;color:white;' : ''">
            {{ sub }}
        </button>
        <Collins class="collins" v-if="curPanel === '柯林斯'" :mydata="collins" />
        <div class="discrimination" v-else-if="curPanel === '辨析'" v-html="discriminationHTML"></div>
        <div class="word-group" v-else-if="curPanel === '词组'" v-html="wordGroupHTML"></div>
        <div class="rel-word" v-else-if="curPanel === '同根词'" v-html="relWordHTML"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import Collins from "./YDCollins.vue"
import { search, YoudaoResultLex } from "./engine"
import { t } from "../../lang/helper"

// import Plugin from "../plugin"
// const plugin: Plugin = getCurrentInstance().appContext.config.globalProperties.plugin

const props = defineProps<{
    word: string,
    theme?: any,
}>()

function play(i: number) {
    (new Audio(prons.value[i].url)).play()
}

let word = ref("")
let meaningHTML = ref("")
let translationHTML = ref("")
let prons = ref([])
let curPanel = ref("柯林斯")
let collins = ref([{}])
let discriminationHTML = ref("")
let wordGroupHTML = ref("")
let relWordHTML = ref("")

async function searchWord(text: string) {
    let res = await search(text)
    if (!res) {
        return
    }
    let result = res.result as YoudaoResultLex
    word.value = result.title
    meaningHTML.value = result.basic
    translationHTML.value = result.translation
    prons.value = result.prons
    collins.value = result.collins
    discriminationHTML.value = result.discrimination
    wordGroupHTML.value = result.wordGroup
    relWordHTML.value = result.relWord
}

watch(
    () => props.word,
    (newVal) => {
        searchWord(newVal)
    }
)
</script>
