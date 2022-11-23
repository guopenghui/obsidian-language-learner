<template>
    <section class="dict-item" :class="{open: isOpen, expand: isExpand, loading: isLoading,}">
        <header class="dict-item-header" @click="onOpen">
            <span>{{props.name}}</span>
            <div class="dict-loading" style="padding-left: 20px;">searching...</div>
            <div class="empty-area"></div>
            <button>
                <svg class="fold-arrow" width="18" height="18" viewBox="0 0 59.414 59.414" xmlns="http://www.w3.org/2000/svg"><path class="dictItemHead-FoldArrowPath" d="M43.854 59.414L14.146 29.707 43.854 0l1.414 1.414-28.293 28.293L45.268 58"></path></svg>
            </button>
        </header>
        <div class="dict-item-body">
            <article>
                <slot></slot>
            </article>
            <button class="fold-mask" @click="onExpand">
                <svg class="fold-mask-arrow" width="15" height="15" viewBox="0 0 59.414 59.414" xmlns="http://www.w3.org/2000/svg"><path d="M58 14.146L29.707 42.44 1.414 14.145 0 15.56 29.707 45.27 59.414 15.56"></path></svg>
            </button>
        </div>
    </section>
</template>

<script setup lang="ts">
import { ref, watch, getCurrentInstance } from "vue"
import PluginType from "../plugin"
import { getRGB } from "../utils/style"
import store from "./store"

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType
let defaultHeight = plugin.settings.dict_height

let isOpen = ref(false)
let isExpand = ref(false)
let isLoading = ref(false)

const props = defineProps<{
    loading: boolean,
    name: string,
}>()

watch(() => props.loading, (loading) => {
    isLoading.value = loading
    if(loading){
        isOpen.value = false
        isExpand.value = false
    } else {
        isOpen.value = true
    }
})

function onOpen() {
    if(isOpen.value) {
        isOpen.value = false
        isExpand.value = false
    } else {
        isOpen.value = true
    }
}

function onExpand() {
    isExpand.value = true
}

// react to theme change
let bgRGB = getRGB(".workspace-leaf", "background-color")
let makeRGBA = (rgb: typeof bgRGB, alpha: number) => `rgba(${rgb.R},${rgb.G},${rgb.B}, ${alpha})`
let bgRGBA1 = ref(makeRGBA(bgRGB, 0))
let bgRGBA2 = ref(makeRGBA(bgRGB, 0.5))
watch(
    () => store.themeChange,
    () => {
        bgRGB = getRGB(".workspace-leaf", "background-color")
        bgRGBA1.value = makeRGBA(bgRGB, 0)
        bgRGBA2.value = makeRGBA(bgRGB, 0.5)
    }
)
 
</script>

<style lang="scss">
.dict-item {
    header.dict-item-header {
        display: flex;
        border-top: 2px dashed gray;
        height: 22px;
        .empty-area {
            flex: 1;
        }
        button {
            color: rgb(236, 239, 244);
            width: 19px;
            height: 19px;
            background: 0 0;
            border: none;
            padding: 0;
            cursor: pointer;
            box-shadow: none;
            &:hover {box-shadow: none;}
            .fold-arrow {
                transition: transform .4s;
                padding: 3px;
                fill: gray;
            }
        }
    }
    .dict-item-body {
        position: relative;
        overflow: hidden;
        padding-top: 10px;
        transition: max-height .5s;
        .fold-mask {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 50px;
            padding: 0;
            border: none;
            box-shadow: none;
            background: linear-gradient(v-bind(bgRGBA1) 40%,v-bind(bgRGBA2) 60%,var(--background-secondary) 100%);
            cursor: pointer;
            .fold-mask-arrow {
                position: absolute;
                z-index: 10;
                bottom: 0;
                fill: gray;
                margin: 0 auto;
            }
        }
    }
    &:not(.open) {
        .fold-mask {display:none;}
        .dict-item-body {
            max-height: 10px;
        }
    }
    &.expand {
        .fold-mask {display:none;}
        .dict-item-body {
            max-height: 5000px;
            transition: max-height 2s;
        }
    }
    &.open {
        .fold-arrow {
            transform: rotate(-90deg);
            transition: transform .4s;
        }
    }
    &.open:not(.expand) {
        .dict-item-body {
            max-height: v-bind(defaultHeight);
        }
    }
    &:not(.loading) {
        .dict-loading { display: none; }
    }
}
</style>