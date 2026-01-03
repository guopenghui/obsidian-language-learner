<template>
    <div class="word-more">
        <div class="word-notes" v-if="(notes.length > 0)">
            <h2>Notes:</h2>
            <p v-for="n in notes" :key="n">{{ n }}</p>
        </div>
        <div class="word-sens" v-if="(sentences.length > 0)">
            <h2>Sentences:</h2>
            <div class="word-sen" v-for="sen in sentences" :key="sen.id || sen.sentence">
                <p v-html="sen.sentence"></p>
                <p v-html="sen.trans"></p>
                <p v-html="sen.origin"></p>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import {getCurrentInstance, ref, watch, onMounted} from 'vue';
import PluginType from "@/plugin";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string;
}>();

const sentences = ref<any[]>([]);
const notes = ref<string[]>([]);

async function load() {
    try {
        console.log("load word more", props.word);
        const data = await plugin.storage.DB().getExpression(props.word);
        notes.value = data?.notes || [];
        sentences.value = (data?.sentences || []).map((sen: any) => {
            return {
                ...sen,
                sentence: highlight(sen.sentence, props.word)
            };
        });
    } catch (error) {
        sentences.value = [];
        notes.value = [];
    }
}

watch(() => props.word, () => { load(); }, { immediate: true });
onMounted(() => { load(); });

function highlight(text: string, word: string) {
    if (!text) return text;

    const expr = word.toLowerCase();

    // 使用全局正则表达式进行替换，避免只替换第一个匹配项
    const exprRegex = new RegExp(`(${expr})`, 'gi');
    text = text.replace(exprRegex, '<em>$1</em>');

    return text;
}
</script>

<style lang="scss">
.word-more {
    h2 {
        margin: 0.5em 0;
    }

    .word-notes {
        user-select: text;

        p {
            white-space: pre-line;
            margin: 0.5em 5px;
        }
    }

    .word-sens {
        user-select: text;

        .word-sen {
            margin-bottom: 5px;
            border: 1px solid gray;
            border-radius: 5px;

            p {
                &:first-child {
                    font-style: italic;

                    em {
                        font-weight: bold;
                        color: var(--interactive-accent)
                    }
                }

                margin: 0.5em 5px;
            }
        }
    }
}
</style>
