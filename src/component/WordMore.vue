<template>
    <div class="word-more">
        <div class="word-notes" v-if="(notes.length > 0)">
            <h2>Notes:</h2>
            <p v-for="n in notes">{{ n }}</p>
        </div>
        <div class="word-sens" v-if="(sentences.length > 0)">
            <h2>Sentences:</h2>
            <div class="word-sen" v-for="sen in sentences">
                <p v-html="sen.text"></p>
                <p v-html="sen.trans"></p>
                <p v-html="sen.origin"></p>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, getCurrentInstance } from 'vue';
import PluginType from "@/plugin";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string;
}>();

let { sentences, notes } = await plugin.db.getExpression(props.word);

sentences.forEach((_, i) => {
    sentences[i].text = highlight(sentences[i].text, props.word);
});

function highlight(text: string, word: string) {
    const expr = word.toLowerCase();
    const Expr = word[0].toUpperCase() + word.slice(1);
    text = text.replace(expr, `<em>${expr}</em>`);
    text = text.replace(Expr, `<em>${Expr}</em>`);
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