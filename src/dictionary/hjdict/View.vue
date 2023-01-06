<template>
    <div id="hjdict">
        <div v-for=" en in entries" v-html="en"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, getCurrentInstance } from "vue";
import { search } from "./engine";
import { useLoading } from "@dict/uses";
import PluginType from "@/plugin";
let plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string,
}>();
const emits = defineEmits<{
    (event: "loading", status: { id: string, loading: boolean, result: boolean; }): void;
}>();

let entries = ref<string[]>([]);
async function onSearch(): Promise<boolean> {
    let res = await search(props.word, { lang: plugin.settings.foreign });
    if (res.result.type === "lex") {
        entries.value = res.result.entries;
        return true;
    } else {
        return false;
    }
}

useLoading(() => props.word, "hjdict", onSearch, emits);

</script>

<style lang="scss">
#hjdict {
    font-size: 1.1em;

    dd {
        margin-inline-start: 15px;
    }

    ul {
        padding-inline-start: 20px;
    }

    h3 {
        font-size: 1.3em;
        line-height: 1.3;
        font-weight: 700;
        padding: 0;
    }

    p {
        margin: 0.5em 0;

        &.detail-source {
            span {
                font-size: 0.8em;
                color: white;
                line-height: 1.2;
                display: inline-block;
                border-radius: 2px;
                text-align: center;
                margin-left: 7px;
                padding: 1px 3px;

                &.collins-icon {
                    background-color: #c94444
                }

                &.wys-icon {
                    background-color: #414585;
                }
            }
        }
    }

    h2 {
        font-size: 1.4em;
        font-weight: 500;
        padding-bottom: 5px;
        border-bottom: 1px solid gray;
        margin-bottom: 10px;
    }

    .word-info {
        h2 {
            font-size: 1.3em;
            font-weight: 700;
        }
    }

    .detail-tags-en {
        display: block;
        list-style-type: none;
        overflow: hidden;
        padding: 0;

        li {
            height: 16px;
            line-height: 1.2;
            background-color: #f0f0f0;
            border-radius: 2px;
            text-align: center;
            color: gray;
            float: left;
            font-size: 1em;
            padding: 0 4px;
            margin-right: 8px;
        }
    }

    .detail-groups {
        margin-top: 1em;

        dt {
            font-size: 1.1em;
            margin-bottom: 0.8em;
            font-weight: 700;
            line-height: 1.2;
        }

        dd {
            margin: 0 0 1em 1.5em;
            display: list-item;
            list-style-type: decimal;

            &:first-of-type:last-of-type {
                list-style-type: none;
            }

            ul {
                padding-inline-start: 15px;
            }

            h3 {
                font-size: 1em;
                font-weight: 400;
                line-height: 1.2;
                margin: 0 0 0.5em;
                padding: 0;
            }
        }
    }
}
</style>