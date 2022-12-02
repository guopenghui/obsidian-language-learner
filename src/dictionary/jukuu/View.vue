<template>
    <div id="jukuu">
        <ul class="jukuu-sens">
            <li class="jukuu-sen" v-for="sen in result.sens">
                <p class="jukuu-trans" v-html="sen.trans"></p>
                <p class="jukuu-ori">{{ sen.original }}</p>
                <p class="jukuu-src">{{ sen.src }}</p>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { search, JukuuResult } from "./engine";

const props = defineProps<{
    word: string,
}>();
const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean; }): void;
}>();

let result = reactive<JukuuResult>({ lang: "zheng", sens: [] });

async function onSearch(word: string) {
    try {
        emits("loading", { id: "jukuu", loading: true, result: false });
        let res = await search(word);
        result.sens = res.result.sens;
        emits("loading", { id: "jukuu", loading: false, result: true });
    } catch (e) {
        emits("loading", { id: "jukuu", loading: false, result: false });
    }

}

watch(
    () => props.word,
    async (word) => {
        onSearch(word);
    }
);
</script>

<style lang="scss">
#jukuu {
    ul.jukuu-sens {
        padding-left: 20px;

        li.jukuu-sen {
            margin: 0.5em 0;

            p {
                margin: 0;

                b {
                    color: #f9690e
                }
            }

            .jukuu-ori {
                color: olive
            }

            .jukuu-src {
                font-size: 0.9em;
                text-align: right;
            }
        }
    }
}
</style>