<template>
    <div id="deepl">
        <p class="origin">
            <strong>原文: </strong>
            {{ word }}
        </p>
        <p class="trans">
            <strong>结果: </strong>
            {{ result }}
        </p>
    </div>
</template>

<script setup lang='ts'>
import { ref, getCurrentInstance } from 'vue'
import { useLoading } from "@dict/uses"
import { search } from "./engine"
import PluginType from "@/plugin"

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string,
}>();
const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean; }): void;
}>();

let result = ref("");

async function onSearch(): Promise<boolean> {
    let res = await search(props.word, plugin.settings.foreign);
    if (!res) return false;

    result.value = res;
    return true;
}

useLoading(() => props.word, "deepl", onSearch, emits);

</script>

<style lang="scss">
#deepl {
    p {
        margin-top: 2px;
        margin-bottom: 4px;
    }
}
</style>