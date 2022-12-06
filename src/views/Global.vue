<template>
    <div id="langr-global" ref="global">
        <PopupSearch :x="searchX" :y="searchY" ref="search" v-if="store.popupSearch" v-show="showSearch" />
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { onClickOutside } from "@vueuse/core";
import store from "@/store";
import { getPageSize, optimizedPos } from "@/utils/style";
import { useEvent } from "@/utils/use";
import PopupSearch from "./PopupSearch.vue";

const global = ref(null);

let showSearch = ref(false);
// 重新再设置打开popup_search时，重置showSearch状态
watch(() => store.popupSearch, (open) => {
    if (open) {
        showSearch.value = false;
    }
});

let search = ref<InstanceType<typeof PopupSearch>>(null);

function closeSearch(evt: MouseEvent) {
    let target = evt.target as HTMLElement;
    if (target.hasClass("word") ||
        target.hasClass("phrase") ||
        target.matchParent("#langr-learn-panel") ||
        window.getSelection().toString() ||
        search.value.pinned
    ) {
        return;
    }
    showSearch.value = false;
}
onClickOutside(search, closeSearch);

let searchX = ref(0);
let searchY = ref(0);
useEvent(window, "obsidian-langr-search", (evt) => {
    let { pageW, pageH } = getPageSize();
    let evtPos = evt.detail.evtPosition;
    if (evtPos) {
        let { x, y } = optimizedPos({ h: pageH, w: pageW }, { h: 520, w: 450 }, evtPos, 60, 30);
        searchX.value = x;
        searchY.value = y;

    }
    showSearch.value = true;
})


</script>

<style>

</style>