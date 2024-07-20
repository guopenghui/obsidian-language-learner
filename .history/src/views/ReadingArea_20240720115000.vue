<template>
    <div id="langr-reading" ref="reading" style="height: 100%">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig"
            style="height: 100%; display: flex; flex-direction: column">
            <!-- 功能区 -->
            <div class="function-area">
                <audio controls v-if="audioSource" :src="audioSource" />
                <div style="display: flex">
                    <button @click="activeNotes = true">做笔记</button>
                    <div style="
                            flex: 1;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        ">
                        <CountBar v-if="plugin.settings.word_count" :unknown="unknown" :learn="learn"
                            :ignore="ignore" />
                    </div>
                    <button v-if="page * pageSize < totalLines" class="finish-reading" @click="addIgnores">
                        结束阅读并转入下一页
                    </button>
                    <button v-else class="finish-reading" @click="addIgnores">
                        结束阅读
                    </button>
                </div>
            </div>
            <!-- 阅读区 -->
            <div class="text-area" style="
                    flex: 1;
                    overflow: auto;
                    padding-left: 5%;
                    padding-right: 5%;
                " :style="{
                    fontSize: store.fontSize,
                    fontFamily: store.fontFamily,
                    lineHeight: store.lineHeight,
                }" v-html="renderedText" />
            <!-- 底栏 -->
            <div class="pagination" style="
                    padding-top: 10px;
                    border-top: 2px solid gray;
                    display: flex;
                    flex-direction: column;
                ">
                <NPagination style="justify-content: center" v-model:page="page" v-model:page-size="pageSize"
                    :item-count="totalLines" show-size-picker :page-sizes="pageSizes" :page-slot="pageSlot" />
            </div>
            <NDrawer v-model:show="activeNotes" :placement="'bottom'" :close-on-esc="true" :auto-focus="true"
                :on-after-enter="afterNoteEnter" :on-after-leave="afterNoteLeave" to="#langr-reading"
                :default-height="250" resizable>
                <NDrawerContent title="Notes">
                    <div class="note-area">
                        <NInput class="note-input" v-model:value="notes" type="textarea" :autosize="{ minRows: 5 }" />
                        <div class="note-rendered" @mouseover="onMouseOver" ref="renderedNote"></div>
                    </div>
                </NDrawerContent>
            </NDrawer>
        </NConfigProvider>
    </div>
</template>

<script setup lang="ts">
import {
    ref,
    Ref,
    getCurrentInstance,
    computed,
    watch,
    onMounted,
    onUnmounted,
    watchEffect,
} from "vue";
import {
    NPagination,
    NConfigProvider,
    darkTheme,
    NDrawer,
    NDrawerContent,
    NInput,
    GlobalThemeOverrides,
} from "naive-ui";
import { MarkdownRenderer, Platform } from "obsidian";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import store from "@/store";
import { ReadingView } from "./ReadingView";
import CountBar from "./CountBar.vue";
import{processContent} from "../plugin";
let vueThis = getCurrentInstance();
var view = vueThis.appContext.config.globalProperties.view as ReadingView;
let plugin = view.plugin as PluginType;
let contentEl = view.contentEl as HTMLElement;

// 切换明亮/黑暗模式
const theme = computed(() => {
    return store.dark ? darkTheme : null;
});

const themeConfig: GlobalThemeOverrides = {
    Drawer: {
        bodyPadding: "8px 12px",
        headerPadding: "4px 6px",
        titleFontWeight: "700",
    },
};

let frontMatter = plugin.app.metadataCache.getFileCache(view.file).frontmatter;
let audioSource = (frontMatter["langr-audio"] || "") as string;
if (audioSource && audioSource.startsWith("~/")) {
    const prefix = Platform.isDesktopApp ? "app://local/" : "http://localhost/_capacitor_file_";
    audioSource =
        prefix + plugin.constants.basePath + audioSource.slice(1);
}

// 记笔记
let activeNotes = ref(false);
let notes = ref("");
async function afterNoteEnter() {
    notes.value = await view.readContent("notes", true);
}
async function afterNoteLeave() {
    view.writeContent("notes", notes.value);
}

let renderedNote = ref<HTMLElement>();
watchEffect(async (clean) => {
    if (!renderedNote.value) return;
    await MarkdownRenderer.renderMarkdown(
        notes.value,
        renderedNote.value,
        view.file.path,
        null
    );
    clean(() => {
        renderedNote.value?.empty();
    });
});

function onMouseOver(e: MouseEvent) {
    let target = e.target as HTMLElement;
    if (target.hasClass("internal-link")) {
        app.workspace.trigger("hover-link", {
            event: e,
            source: "preview",
            hoverParent: { hoverPopover: null },
            targetEl: target,
            linktext: target.getAttr("href"),
            soursePath: view.file.path,
        });
    }
}

// 拆分文本
let lines = view.text.split("\n");
let segments = view.divide(lines);

let article = lines.slice(segments["article"].start, segments["article"].end);
let totalLines = article.length;

// 计数
let unknown = ref(0);
let learn = ref(0);
let ignore = ref(0);
let countChange = ref(true);
let refreshCount = () => {
    countChange.value = !countChange.value;
};

if (plugin.settings.word_count) {
    watch(
        [countChange],
        async () => {
            [unknown.value, learn.value, ignore.value] =
                await plugin.parser.countWords(article.join("\n"));
        },
        { immediate: true }
    );

    onMounted(() => {
        addEventListener("obsidian-langr-refresh", refreshCount);
    });
    onUnmounted(() => {
        removeEventListener("obsidian-langr-refresh", refreshCount);
    });
}

// 分页渲染文本

const pageSizes = [
    { label: `1 ${t("paragraph")} / ${t("page")}`, value: 2 },
    { label: `2 ${t("paragraph")} / ${t("page")}`, value: 4 },
    { label: `4 ${t("paragraph")} / ${t("page")}`, value: 8 },
    { label: `8 ${t("paragraph")} / ${t("page")}`, value: 16 },
    { label: `16 ${t("paragraph")} / ${t("page")}`, value: 32 },
    { label: `${t("All")}`, value: Number.MAX_VALUE },
];

const pageSlot = Platform.isMobileApp ? 5 : null;

let dp = plugin.settings.default_paragraphs;
let pageSize = dp === "all" ? ref(Number.MAX_VALUE) : ref(parseInt(dp));
let page = view.lastPos
    ? ref(Math.ceil(view.lastPos / pageSize.value))
    : ref(1);

let renderedText = ref("");
let psChange = ref(true); // 标志pageSize的改变
let refreshHandle = ref(true);

// pageSize变化应该使page同时进行调整以尽量保持原阅读位置
// 同时page和pageSize的改变都应该引起langr-pos的改变，但应只修改一次
// 因此引入psChange这个变量
watch([pageSize], async ([ps], [prev_ps]) => {
    let oldPage = page.value;
    page.value = Math.ceil(((page.value - 1) * prev_ps + 1) / ps);
    if (oldPage === page.value) {
        psChange.value = !psChange.value;
    }
});

//监视 page、psChange 和 refreshHandle 的变化，并在变化时执行分页计算、解析文章片段、更新渲染的文本以及更新前置元数据。
watch(
    [page, psChange, refreshHandle],
    async ([p, pc], [prev_p, prev_pc]) => {
        let start = (p - 1) * pageSize.value;
        let end =
            start + pageSize.value > totalLines
                ? totalLines
                : start + pageSize.value;

        renderedText.value = await plugin.parser.parse(
            article.slice(start, end).join("\n")
        );

        if (p !== prev_p || pc != prev_pc) {
            plugin.frontManager.setFrontMatter(
                view.file,
                "langr-pos",
                `${(p - 1) * pageSize.value + 1}`
            );
        }
        processContent();
    },
    { immediate: true }
);

// 设置阅读文字样式

// 添加无视单词
async function addIgnores() {
    let ignores = contentEl.querySelectorAll(
        ".word.new"
    ) as unknown as HTMLElement[];
    let ignore_words: Set<string> = new Set();
    ignores.forEach((el) => {
        ignore_words.add(el.textContent.toLowerCase());
    });
    await plugin.db.postIgnoreWords([...ignore_words]);
    // this.setViewData(this.data)
    refreshHandle.value = !refreshHandle.value;
    dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

    if (page.value * pageSize.value < totalLines) {
        page.value++;
    }

    refreshCount();
    processContent();
}

async function processContent(){

    // 获取包含特定class的元素
    await fetchData();
    let textArea = document.querySelector('.text-area');
    let htmlContent = textArea.innerHTML;
    //使用正则表达式匹配同时包含特定符号的 <p> 标签元素，并去除所有标签保留文本
    htmlContent = htmlContent.replace(/<p>(?=.*!)(?=.*\[)(?=.*\])(?=.*\()(?=.*\)).*<\/p>/g, function(match) {
        var pattern = /!\[(.*?)\]\((.*?)\)/;
        var str = match.replace(/<[^>]+>/g, '');
        var tq = pattern.exec(str);
        var img = document.createElement('img');
        var imgContainer = document.createElement('div');
        imgContainer.style.textAlign = 'center';  // 设置文本居中对齐
        var imgWrapper = document.createElement('div');
        imgWrapper.style.textAlign = 'center';  // 设置为内联块元素，使其水平居中

        if (tq) {
            var altText = tq[1];
            var srcUrl = tq[2];
            
            if (/^https?:\/\//.test(srcUrl)) {
                img.alt = altText;
                img.src = srcUrl;
                imgWrapper.appendChild(img);
                imgContainer.appendChild(imgWrapper);
                return imgContainer.innerHTML; 
            }
            else{
                imgnum = localStorage.getItem('imgnum') || ''
                img.alt = altText;
                img.src =  mergeStrings(imgnum,srcUrl);
                imgWrapper.appendChild(img);
                imgContainer.appendChild(imgWrapper);
                return imgContainer.innerHTML; 
            }
        }
        
    });
    // 替换 # 开头的文本为 h1
    htmlContent = htmlContent.replace(/(<span class="stns"># (.*?)<\/span>)(?=\s*<\/p>)/g, '<span class="stns"><h1>$2</h1></span>');
    
    // 替换 ## 开头的文本为 h2
    htmlContent = htmlContent.replace(/(<span class="stns">)## (.*?)(<\/span>)(?=\s*<\/p>)/g, '<span class="stns"><h2>$2</h2></span>');
    
    // 替换 ### 开头的文本为 h3
    htmlContent = htmlContent.replace(/(<span class="stns">### (.*?)<\/span>)(?=\s*<\/p>)/g, '<span class="stns"><h3>$2</h3></span>');
    
    // 替换 #### 开头的文本为 h4
    htmlContent = htmlContent.replace(/(<span class="stns">#### (.*?)<\/span>)(?=\s*<\/p>)/g, '<h4>$2</h4>');
    
    // 替换 ##### 开头的文本为 h5
    htmlContent = htmlContent.replace(/(<span class="stns">##### (.*?)<\/span>)(?=\s*<\/p>)/g, '<h5>$2</h5>');
    //渲染粗体
    htmlContent = htmlContent.replace(/\*\*((?:.|\n)*?)\*\*/g, function(match, group1) {
        return ` <b>${group1}</b> `;
    });
    htmlContent = htmlContent.replace(/\_\_((?:.|\n)*?)\_\_/g, function(match, group1) {
        return ` <b>${group1}</b> `;
    });

    //渲染斜体
    htmlContent = htmlContent.replace(/ \*((?:.|\n)*?)\* /g, function(match, group1) {
        return ` <i>${group1}</i> `;
    });
    htmlContent = htmlContent.replace(/ \_((?:.|\n)*?)\_ /g, function(match, group1) {
        return ` <i>${group1}</i> `;
    });


    htmlContent = htmlContent.replace(/\~\~((?:.|\n)*?)\~\~/g, function(match, group1) {
        return ` <del>${group1}</del> `;
    });
    
    // 移除 "<span class="stns">!</span>" 标签
    //htmlContent = htmlContent.replace(/<span class="stns">!<\/span>/g, '');
    // 将修改后的HTML内容重新设置回元素
    textArea.innerHTML = htmlContent;
}

function mergeStrings(str1:string, str2:string) {
    // 获取 str2 的前 3 个字符
    let prefix = str2.substring(0, 3);
    // 在 str1 中查找 prefix 的位置
    let index = str1.indexOf(prefix);

    // 如果找到匹配的前缀
    if (index !== -1&& index !== 0 && str1.charAt(index - 1) === '/') {
        // 截断 str1 并与 str2 相连
        let firstPart = str1.substring(0, index);
        return firstPart + str2;
    } else {
        // 如果没有找到匹配的前缀，则返回 str1 和 str2 原样相连
        return str1 + str2;
    }
}

let reading = ref(null);
let prevEl: HTMLElement = null;
//用户选择单词的事件
if (plugin.constants.platform === "mobile") {
    useEvent(reading, "click", (e) => {
        let target = e.target as HTMLElement;
        if (target.hasClass("word") || target.hasClass("phrase")) {
            e.preventDefault();
            e.stopPropagation();
            if (prevEl) {
                let selectSpan = view.wrapSelect(prevEl, target);
                if (selectSpan) {
                    plugin.queryWord(
                        selectSpan.textContent,
                        selectSpan,
                        { x: e.pageX, y: e.pageY }
                    );
                }
                prevEl = null;
            } else {
                prevEl = target;
            }
        } else {
            view.removeSelect();
            prevEl = null;
        }

    });
} else {
    useEvent(reading, "pointerdown", (e) => {
        let target = e.target as HTMLElement;
        if (target.hasClass("word") || target.hasClass("phrase") || target.hasClass("select")) {
            prevEl = target;
        }
    });
    useEvent(reading, "pointerup", (e) => {
        let target = e.target as HTMLElement;
        if (target.hasClass("word") || target.hasClass("phrase") || target.hasClass("select")) {
            e.preventDefault();
            e.stopPropagation();
            if (prevEl) {
                let selectSpan = view.wrapSelect(prevEl, target);
                if (selectSpan) {
                    plugin.queryWord(
                        selectSpan.textContent,
                        selectSpan,
                        { x: e.pageX, y: e.pageY }
                    );
                }
                prevEl = null;
            }
        } else {
            view.removeSelect();
        }
    });
}
async function fetchData() {
    let previousContent = ''; // 上一次抓取到的内容
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(() => {
            let textArea = document.querySelector('.text-area');

            if (textArea) {
                let currentContent = textArea.innerHTML.trim();
                
                if (previousContent !== ''&&previousContent !==currentContent) {
                    clearInterval(intervalId); // 内容变化时清除定时器
                    resolve(currentContent); // 解析 Promise，传递最终内容
                } else {
                    previousContent = currentContent; // 更新上一次抓取的内容
                }
            } else {
                clearInterval(intervalId); 
            }
        }, 100);
    });
}

</script>

<style lang="scss">
#langr-reading {
    user-select: none;

    .function-area {
        padding-bottom: 10px;
        border-bottom: 2px solid gray;

        button {
            width: auto;
        }
    }

    .text-area {
        touch-action: none;

        span.word {
            user-select: contain;
            border: 1px solid transparent;
            cursor: pointer;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }
        }

        span.phrase {
            background-color: transparent;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }
        }

        span.stns {
            border: 1px solid transparent;
        }

        span {
            .new {
                background-color: #add8e644;
            }

            .learning {
                background-color: #ff980055;
            }

            .familiar {
                background-color: #ffeb3c55;
            }

            .known {
                background-color: #9eda5855;
            }

            .learned {
                background-color: #4cb05155;
            }
        }

        span.other {
            user-select: text;
        }

        .select {
            background-color: #90ee9060;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border: 1px solid green;
            }
        }
    }

    .note-area {
        display: flex;
        height: 100%;
        width: 100%;

        .note-input {
            flex: 1;
        }

        .note-rendered {
            border: 1px solid gray;
            border-radius: 3px;
            flex: 1;
            padding: 5px;
            margin-left: 2px;
            overflow: auto;
        }
    }
}

.is-mobile #langr-reading {
    .pagination {
        padding-bottom: 48px;
    }
}
</style>
