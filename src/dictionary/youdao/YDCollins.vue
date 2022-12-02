<template>
    <div class="wrapper">
        <select v-if="props.mydata.length > 1" v-model="mode">
            <option value="word">单词</option>
            <option value="phase">短语</option>
        </select>
        <div class="content" v-html="showedHTML"></div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface Collins {
    [index: number]: {
        title: string,
        content: string,
    };
}

const props = defineProps({
    mydata: {
        type: Object,
        default: () => {
            return [] as Collins[];
        }
    }
});

let mode = ref("word");

let showedHTML = computed(() => {
    if (props.mydata.length === 0)
        return "";
    if (props.mydata.length === 2) {
        if (mode.value === "phase")
            return props.mydata[1].content;
    }
    return props.mydata[0].content;
})

</script>