<template>
    <NMessageProvider>
        <NModal
            :show="show"
            @update:show="$emit('update:show', $event)"
            :mask-closable="true"
            :closable="true"
            :preset="'card'"
            :title="word || 'Word Details'"
            :style="{ width: '80%', maxWidth: '800px', maxHeight: '85vh' }"
            :segmented="{ content: 'soft', footer: 'soft' }"
            class="word-more-modal"
        >
        <template #header-extra>
            <NSpace>
                <NButton
                    v-if="notes.length > 0 || sentences.length > 0"
                    size="small"
                    type="info"
                    ghost
                    @click="copyAll"
                >
                    <template #icon>
                        <span style="font-size: 1.2em">📋</span>
                    </template>
                    {{ t("Copy All") }}
                </NButton>
            </NSpace>
        </template>

        <!-- 加载状态 -->
        <NSpin :show="loading">
            <!-- 空状态 -->
            <div
                v-if="!loading && notes.length === 0 && sentences.length === 0"
                class="empty-state"
            >
                <div class="empty-text">{{ t('No notes or sentences for this word') }}</div>
            </div>

            <!-- 内容区域 -->
            <div v-else class="word-more-content">
                <!-- Notes 部分 -->
                <div v-if="notes.length > 0" class="section notes-section">
                    <div class="section-header">
                        <h3>{{ t("Notes") }}</h3>
                        <NButton
                            size="tiny"
                            text
                            type="info"
                            @click="copyNotes"
                        >
                            📋 {{ t("Copy") }}
                        </NButton>
                    </div>
                    <div class="notes-list">
                        <div
                            v-for="(note, index) in notes"
                            :key="index"
                            class="note-item"
                        >
                            <p class="note-text">{{ note }}</p>
                        </div>
                    </div>
                </div>

                <!-- Sentences 部分 -->
                <div v-if="sentences.length > 0" class="section sentences-section">
                    <div class="section-header">
                        <h3>{{ t("Sentences") }}</h3>
                        <NButton
                            size="tiny"
                            text
                            type="info"
                            @click="copySentences"
                        >
                            📋 {{ t("Copy") }}
                        </NButton>
                    </div>
                    <div class="sentences-list">
                        <div
                            v-for="(sen, index) in sentences"
                            :key="sen.id || sen.sentence || index"
                            class="sentence-item"
                        >
                            <p
                                class="sentence-text"
                                v-html="sen.sentence"
                            ></p>
                            <p
                                v-if="sen.trans"
                                class="sentence-trans"
                                v-html="sen.trans"
                            ></p>
                            <p
                                v-if="sen.origin"
                                class="sentence-origin"
                                v-html="sen.origin"
                            ></p>
                        </div>
                    </div>
                </div>
            </div>
        </NSpin>

        <template #footer>
            <NSpace justify="end">
                <NButton @click="$emit('update:show', false)">
                    {{ t("Close") }}
                </NButton>
            </NSpace>
        </template>
        </NModal>
    </NMessageProvider>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { NModal, NButton, NSpace, NSpin, useMessage, NMessageProvider } from 'naive-ui';
import { getCurrentInstance } from 'vue';
import PluginType from "@/plugin";
import { t } from '@/lang/helper';

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;
const message = useMessage();

const props = defineProps<{
    word: string;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
}>();

const sentences = ref<any[]>([]);
const notes = ref<string[]>([]);
const loading = ref(false);

async function load() {
    console.log("\n========== [WordMoreModal] load() called ==========");
    console.log("props.word:", props.word);
    console.log("props.show:", props.show);

    if (!props.word) {
        console.log("❌ No word provided, returning early");
        sentences.value = [];
        notes.value = [];
        return;
    }

    loading.value = true;
    console.log("⏳ Loading started for word:", props.word);

    try {
        console.log("📞 Calling plugin.storage.DB().getExpression(", props.word, ")");

        const data = await plugin.storage.DB().getExpression(props.word);

        console.log("✅ API returned data:");
        console.log("  - Full data:", JSON.stringify(data, null, 2));
        console.log("  - data?.notes:", data?.notes);
        console.log("  - data?.sentences:", data?.sentences);
        console.log("  - notes type:", Array.isArray(data?.notes) ? 'array' : typeof data?.notes);
        console.log("  - sentences type:", Array.isArray(data?.sentences) ? 'array' : typeof data?.sentences);
        console.log("  - notes length:", data?.notes?.length || 0);
        console.log("  - sentences length:", data?.sentences?.length || 0);

        if (data?.notes && data.notes.length > 0) {
            console.log("  📝 Notes sample [0]:", data.notes[0]);
        }

        if (data?.sentences && data.sentences.length > 0) {
            console.log("  💬 Sentences sample [0]:", JSON.stringify(data.sentences[0], null, 2));
        }

        notes.value = data?.notes || [];
        sentences.value = (data?.sentences || []).map((sen: any, index: number) => {
            console.log(`  🔍 Processing sentence ${index}:`, sen);
            const highlighted = highlight(sen.sentence || '', props.word);
            console.log(`     - Original: "${sen.sentence}"`);
            console.log(`     - Highlighted: "${highlighted}"`);
            return {
                ...sen,
                sentence: highlighted
            };
        });

        console.log("\n📊 Final state:");
        console.log("  - notes.value.length:", notes.value.length);
        console.log("  - sentences.value.length:", sentences.value.length);
        console.log("  - notes.value:", notes.value);
        console.log("  - sentences.value:", sentences.value);

    } catch (error) {
        console.error("❌❌❌ [WordMoreModal] Failed to load word details:");
        console.error("Error:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
        sentences.value = [];
        notes.value = [];
        message.error(t("Failed to load word details"));
    } finally {
        loading.value = false;
        console.log("⏳ Loading finished, loading.value = false");
        console.log("========== [WordMoreModal] load() end ==========\n");
    }
}

// 同时监听 word 和 show，确保正确加载
watch([() => props.word, () => props.show], ([newWord, newShow]) => {
    console.log("\n========== [WordMoreModal] Watch triggered ==========");
    console.log("newWord:", newWord);
    console.log("newShow:", newShow);
    console.log("newWord type:", typeof newWord);
    console.log("newWord truthy:", !!newWord);
    console.log("Condition check: newShow && newWord =", newShow && newWord);

    if (newShow && newWord) {
        console.log("✅ Condition met, calling load()");
        load();
    } else {
        console.log("⏸️ Condition not met, skipping load()");
        if (!newShow) console.log("   Reason: newShow is false");
        if (!newWord) console.log("   Reason: newWord is falsy");
    }
    console.log("========== [WordMoreModal] Watch end ==========\n");
}, { immediate: true });

// 监控数据变化
watch([notes, sentences, loading], ([newNotes, newSentences, newLoading]) => {
    console.log("\n🔄 [WordMoreModal] Data changed:");
    console.log("  - loading:", newLoading);
    console.log("  - notes.length:", Array.isArray(newNotes) ? newNotes.length : 'not array');
    console.log("  - sentences.length:", Array.isArray(newSentences) ? newSentences.length : 'not array');

    if (!newLoading && Array.isArray(newNotes) && newNotes.length > 0) {
        console.log("  📝 First note:", newNotes[0]);
    }
    if (!newLoading && Array.isArray(newSentences) && newSentences.length > 0) {
        console.log("  💬 First sentence:", newSentences[0]);
    }
}, { deep: true });

function highlight(text: string, word: string) {
    if (!text || !word) return text;

    try {
        // 转义特殊字符
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exprRegex = new RegExp(`(${escapedWord})`, 'gi');
        return text.replace(exprRegex, '<mark>$1</mark>');
    } catch (error) {
        console.error("Highlight error:", error);
        return text;
    }
}

// 复制功能
function copyNotes() {
    const text = notes.value.join('\n\n');
    copyToClipboard(text, t("Notes copied"));
}

function copySentences() {
    const text = sentences.value
        .map(sen => {
            let parts = [sen.sentence?.replace(/<mark>|<\/mark>/g, '')];
            if (sen.trans) parts.push(sen.trans);
            if (sen.origin) parts.push(sen.origin);
            return parts.join('\n');
        })
        .join('\n\n');
    copyToClipboard(text, t("Sentences copied"));
}

function copyAll() {
    const parts: string[] = [];

    if (notes.value.length > 0) {
        parts.push(`=== ${t("Notes")} ===`);
        parts.push(notes.value.join('\n\n'));
    }

    if (sentences.value.length > 0) {
        if (parts.length > 0) parts.push('');
        parts.push(`=== ${t("Sentences")} ===`);
        parts.push(
            sentences.value
                .map(sen => {
                    let senParts = [sen.sentence?.replace(/<mark>|<\/mark>/g, '')];
                    if (sen.trans) senParts.push(sen.trans);
                    if (sen.origin) senParts.push(sen.origin);
                    return senParts.join('\n');
                })
                .join('\n\n')
        );
    }

    const text = parts.join('\n\n');
    copyToClipboard(text, t("All content copied"));
}

function copyToClipboard(text: string, successMsg: string) {
    navigator.clipboard.writeText(text).then(() => {
        message.success(successMsg);
    }).catch(() => {
        message.error(t("Failed to copy"));
    });
}
</script>

<style lang="scss">
// 全局样式，不受 scoped 限制
.word-more-modal {
    .n-card {
        max-height: 85vh !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
    }

    .n-card__content {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        max-height: calc(85vh - 140px) !important;
        padding-right: 8px !important;

        // NSpin 容器需要有最小高度
        .n-spin {
            min-height: 100%;
            display: flex;
        }

        // NSpin 内容容器
        .n-spin-content {
            min-height: 120px;
            width: 100%;
            display: flex;
            flex-direction: column;
        }

        // 自定义滚动条样式
        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
        }

        &::-webkit-scrollbar-thumb {
            background-color: rgba(128, 128, 128, 0.2);
            border-radius: 3px;

            &:hover {
                background-color: rgba(128, 128, 128, 0.4);
            }
        }

        // Firefox 滚动条
        scrollbar-width: thin;
        scrollbar-color: rgba(128, 128, 128, 0.2) transparent;
    }

    .n-card__footer {
        flex-shrink: 0;
    }
}
</style>

<style lang="scss" scoped>
// 空状态样式
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    min-height: 120px;
    width: 100%;
    text-align: center;

    .empty-text {
        font-size: 14px;
        color: var(--n-text-color-2);
        line-height: 1.6;
        text-align: center;
    }
}

// 内容区域样式
.word-more-content {
    min-height: 120px;
    width: 100%;

    .section {
        margin-bottom: 24px;

        &:last-child {
            margin-bottom: 0;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--n-divider-color);

            h3 {
                margin: 0;
                font-size: 1.2em;
                color: var(--n-text-color);
                font-weight: 600;
            }
        }

        .notes-list {
            .note-item {
                padding: 12px;
                margin-bottom: 8px;
                background: var(--n-color-modal);
                border-radius: 6px;
                border-left: 3px solid var(--n-primary-color);

                &:last-child {
                    margin-bottom: 0;
                }

                .note-text {
                    white-space: pre-line;
                    margin: 0;
                    line-height: 1.6;
                    user-select: text;
                }
            }
        }

        .sentences-list {
            .sentence-item {
                padding: 12px;
                margin-bottom: 8px;
                background: var(--n-color-modal);
                border-radius: 6px;
                border: 1px solid var(--n-border-color);

                &:last-child {
                    margin-bottom: 0;
                }

                p {
                    margin: 6px 0;
                    line-height: 1.6;
                    user-select: text;

                    &:first-child {
                        font-style: italic;
                        color: var(--n-text-color);

                        mark {
                            font-weight: bold;
                            background-color: var(--n-primary-color);
                            color: white;
                            padding: 2px 4px;
                            border-radius: 2px;
                        }
                    }
                }

                .sentence-trans {
                    color: var(--n-text-color-2);
                    font-size: 0.95em;
                }

                .sentence-origin {
                    color: var(--n-text-color-3);
                    font-size: 0.9em;
                }
            }
        }
    }
}
</style>
