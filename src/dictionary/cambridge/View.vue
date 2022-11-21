<template>
    <div id="cambridge">
        <section v-for="entry in result"
            :key="entry.id"
            :id="entry.id"
            @click=""
        >
            <div v-html="entry.html"></div>
        </section>
    </div>
</template>
 

<script setup lang="ts">
import {Notice} from "obsidian"
import { playAudio } from "src/utils/helpers";
import { ref, watch, onMounted, onUnmounted, nextTick} from "vue"
import { CambridgeResult, search } from "./engine"
const props = defineProps<{
    word: string
}>()

const emits = defineEmits<{
    (event: "loading", status:{ id: string, loading: boolean }): void
}>()

let loading = ref(true)

let result = ref<CambridgeResult>([])

async function searchWord(text: string) {
    loading.value = true
    emits("loading", { id: "cambridge", loading: loading.value})

    try {
        let res = await search(text)
        result.value = res.result

        await nextTick()
        loading.value = false
        emits("loading", { id: "cambridge", loading: loading.value})
    } catch(e) {
        // new Notice(e.message)
    }
}


watch(
    () => props.word,
    (word) => {
        searchWord(word)
    }
)

onMounted(() => {
    let cam = document.querySelector("#cambridge")
    // 管理点击事件
    cam.addEventListener("click", (evt) => {
        let target = evt.target as HTMLElement
        // console.log(target)
        if(target.tagName === "HEADER" && target.hasClass("ca_h") || target.matchParent("header.ca_h")) {
            let section = target.matchParent("section")
            section.hasClass("expand")?
                section.removeClass("expand"):
                section.addClass("expand")
        } else if(target.hasClass("speaker")) {
            evt.stopPropagation();
            evt.preventDefault()
            let url = (target as HTMLAnchorElement).href
            playAudio(url)
        }
    })
})

</script>

<style lang="scss">
#cambridge {
    font-size: 1.1em;
    .dgram a{
        color: inherit;
    }
    section[id^=d-cambridge-entry] {
        margin-bottom: 20px;
    }
    h3.dsense_h {
        color: inherit;
        font-size: 1.1em;
        margin-top: 10px;
        margin-bottom: 3px;
    }
    .di-title {
        font-size: 1.3em;
        font-weight: 700; 
        line-height: 1.3;
        h2 {
           font-size: inherit; 
           font-weight: inherit;
           line-height: inherit;
           color: inherit;
        }
    }
    .pos {
        font-style: italic;
        font-weight: 500;
    }
    .dpron-i .region {
        color: #e84427;
        text-transform: uppercase;
        font-weight: 700;
    }
    .dwl {
        margin-top: 5px;
        // border-top: 1px solid #c76e06;
        border-top: 1px solid #fec400;
    }
    .dxref {
        padding: 1px 5px;
        color: white;
        font-weight: 700;
        font-size: .8em;
        text-align: center;
        background-color: #444;
        border-radius: 8px;
    }
    .query {
        color: inherit;
        font-weight: inherit;
        &:hover {
            text-decoration: underline;
        }
    }
    .examp {
        margin-left: 1.3em;
        display: list-item;
        font-style: italic;
        margin-top: 5px;
    }
    .trans {
        display: block;
    }
    li.dexamp.eg {
        font-style: italic;
        display: list-item;
        list-style-type: disc;
        margin-bottom: 5px;
        &::marker {
            text-transform: none;
            color: black;
        }
    }
    .db {
        font-weight: 700;
    }
    .lab {
        font-size: 1.1em;
        font-variant: small-caps;
        font-weight: 500;
    }
    .daccord {
        margin: 10px 0;
        background-color: #fff8e4d7;
        color: black;
        border-radius: 3px;
        header {
            font-weight: 500;
            cursor: pointer;
            line-height: 1.6em;
        }
        section {
            i {
                margin-right: 3px;
            }
            i::before {
                content: "+";
            }
            &>:last-child {
                display: none;
            }
            &.expand {
                i::before {
                    content: "-";
                }
                &>:last-child {
                    display: block;
                }
            }
        }
        span.ti {
            margin-left: 10px;
            .dexample {
                font-style: italic;
            }
        }
    }
}

</style>