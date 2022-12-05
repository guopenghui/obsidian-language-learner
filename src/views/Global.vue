<template>
    <div id="langr-global" ref="global">
        <PopupSearch ref="search" v-show="showSearch" />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { onClickOutside } from "@vueuse/core";
import { useEvent } from "@/utils/use";
import PopupSearch from "./PopupSearch.vue";

const global = ref(null);

let showSearch = ref(false);
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

useEvent(window, "obsidian-langr-search", (evt) => {
    showSearch.value = true;
})


</script>

<style>

</style>