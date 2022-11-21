<template>
    <section class="dict-item" :class="{open: isOpen, expand: isExpand, loading: isLoading,}">
        <header>
            <span>{{props.name}}</span>
            <div class="dict-loading" style="padding-left: 20px;">searching...</div>
            <div class="empty-area"></div>
            <button @click="onOpen">
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
import { ref, watch } from "vue"
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

</script>

<style lang="scss">
.dict-item {
    header {
        display: flex;
        border-top: 2px dashed gray;
        height: 22px;
        .empty-area {
            flex: 1;
        }
        button {
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
            background: linear-gradient(rgba(255,255,255,0) 40%,rgba(255,255,255,.5) 60%,var(--background-secondary) 100%);
            cursor: pointer;
            .fold-mask-arrow {
                position: absolute;
                z-index: 10;
                bottom: 0;
                // left: 0;
                // right: 0;
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
            max-height: 250px;
        }
    }
    &:not(.loading) {
        .dict-loading { display: none; }
    }
}
</style>