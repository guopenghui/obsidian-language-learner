<template>
    <div id="langr-reading" style="height:100%;">
        <NConfigProvider :theme="theme" style=" height:100%; display:flex; flex-direction: column;">
            <div class="function-area" style="padding-bottom:10px; border-bottom: 2px solid gray;">
                <audio controls v-if="audioSource" :src="audioSource"></audio>
                <div style="display:flex;">
                    <span style="flex:1;"></span>
                    <button v-if="page * pageSize < totalLines" class="finish-reading" @click="addIgnores">结束阅读并转入下一页</button>
                    <button v-else class="finish-reading" @click="addIgnores">结束阅读</button>
                </div>
            </div>
            <div class="text-area" 
                style="flex:1; overflow:auto; padding-left: 5%; padding-right: 5%;" 
                v-html="renderedText"/>
            <div class="pagination" style="padding-top:10px; border-top: 2px solid gray; display:flex; flex-direction: column;">
                <NPagination 
                    style="justify-content:center;"
                    v-model:page="page" 
                    v-model:page-size="pageSize" 
                    :item-count="totalLines"
                    show-size-picker 
                    :page-sizes="pageSizes">
                </NPagination>
            </div>
        </NConfigProvider>
    </div>
</template>


<script setup lang="ts">
import { ref, getCurrentInstance, computed, watch, watchEffect } from "vue"
import { NPagination, NConfigProvider, darkTheme } from "naive-ui"
import PluginType from "../plugin"
import { ReadingView } from "./ReadingView"
import store from "./store"
import { t } from "../lang/helper"

let vueThis = getCurrentInstance()
// let rawText = vueThis.appContext.config.globalProperties.data as string
let view = vueThis.appContext.config.globalProperties.view as ReadingView
let plugin = view.plugin as PluginType
let contentEl = view.contentEl as HTMLElement
let theme = document.body.hasClass("theme-dark") ? darkTheme: null

let frontMatter = plugin.app.metadataCache.getFileCache(view.file).frontmatter
let audioSource = frontMatter["langr-audio"] || ""

const pageSizes = [
    {label: `1 ${t("paragraph")} / ${t("page")}`, value: 2},
    {label: `2 ${t("paragraph")} / ${t("page")}`, value: 4},
    {label: `4 ${t("paragraph")} / ${t("page")}`, value: 8},
    {label: `8 ${t("paragraph")} / ${t("page")}`, value: 16},
    {label: `16 ${t("paragraph")} / ${t("page")}`, value: 32},
    {label: `${t("All")}`, value: Number.MAX_VALUE},
]

let page = ref(1)
let dp =plugin.settings.default_paragraphs
let pageSize = dp === "all" ? ref(Number.MAX_VALUE) : ref(parseInt(dp))

// 读取页数
// plugin.frontManager.getFrontMatter(view.file, "langr-pos").then((lastPos) => {
//     if (lastPos) {
//         page.value = Math.ceil(parseInt(lastPos) / pageSize.value)
//     }
// })



// 拆分文本
let lines = store.text.split("\n")
let positions = [] as [string,number][]
positions.push(["article", lines.indexOf("^^^article")],
                ["words", lines.indexOf("^^^words")],
                ["notes", lines.indexOf("^^^notes")]);
positions.sort((a,b) => a[1] - b[1])
positions = positions.filter((v) => v[1] !== -1)
positions.push(["eof", lines.length]);

type Seg = {[K in string]:{start:number, end:number}}
let segments: Seg = {} 
for(let i=0; i<positions.length-1; i++) {
    segments[`${positions[i][0]}`] = {start: positions[i][1] + 1, end: positions[i+1][1]}
}


let article = lines.slice(segments["article"].start, segments["article"].end)
let totalLines = article.length

// 渲染文本
let renderedText = ref("")
let refreshHandle = ref(true)
let psChange = ref(true) // 标志pageSize的改变

// pageSize变化应该使page同时进行调整以尽量保持原阅读位置
// 同时page和pageSize的改变都应该引起langr-pos的改变，但应只修改一次
// 因此引入psChange这个变量
watch([pageSize], async ([ps],[prev_ps]) => {
    let oldPage = page.value
    page.value = Math.ceil(((page.value - 1) * prev_ps + 1)/ps)
    if(oldPage === page.value) {
        psChange.value = !psChange.value
    }
})

let firstInit = true

watch([page,psChange,refreshHandle], async ([p,pc],[prev_p,prev_pc]) => {
    let start = 0
    if(firstInit) {
        let lastPos = await plugin.frontManager.getFrontMatter(view.file, "langr-pos")
        if (lastPos) {
            page.value = Math.ceil(parseInt(lastPos) / pageSize.value)
        }
        start = (page.value - 1) * pageSize.value
        firstInit = false
    } else {
        start = (p - 1) * pageSize.value
    }

    let end = start + pageSize.value > totalLines ?
        totalLines :
        start + pageSize.value

    renderedText.value = await plugin.parser.parse(article.slice(start,end).join("\n"))
    
    if(p !== prev_p || pc!=prev_pc) {
        plugin.frontManager.setFrontMatter(view.file, "langr-pos", `${(p-1)*pageSize.value + 1}`)
    }
}, {immediate: true})


// 添加无视单词
async function addIgnores() {
    let ignores = contentEl.querySelectorAll(".word.new") as unknown as HTMLElement[]
    let ignore_words: Set<string> = new Set()
    ignores.forEach((el) => {
        ignore_words.add(el.textContent.toLowerCase())
    })
    await plugin.db.postIgnoreWords([...ignore_words])
    // this.setViewData(this.data)
    refreshHandle.value = !refreshHandle.value
    dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"))
    
    if(page.value * pageSize.value < totalLines) {
        page.value ++
    }
}


</script>
