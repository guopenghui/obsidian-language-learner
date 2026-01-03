<template>
    <div class="mobile-word-list">
        <NSpace vertical :size="12">
            <div
                v-for="item in data"
                :key="item.expr"
                class="word-card"
                @click="handleEdit(item)"
            >
                <!-- 单词和状态 -->
                <div class="card-header">
                    <div class="word-info">
                        <span class="word-text">{{ item.expr }}</span>
                        <NTag
                            :size="isMobile ? 'tiny' : 'small'"
                            :style="getStatusStyle(item.statusIndex)"
                        >
                            {{ item.status }}
                        </NTag>
                    </div>
                    <NButton
                        size="tiny"
                        type="info"
                        secondary
                        @click.stop="handleEdit(item)"
                    >
                        {{ t("Edit") }}
                    </NButton>
                </div>

                <!-- 含义 -->
                <div v-if="item.meaning" class="card-meaning">
                    <span class="label">{{ t("Meaning") }}:</span>
                    <span class="content">{{ item.meaning }}</span>
                </div>

                <!-- 标签 -->
                <div v-if="item.tags && item.tags.length > 0" class="card-tags">
                    <span class="label">{{ t("Tags") }}:</span>
                    <NSpace :size="4">
                        <NTag
                            v-for="(tag, i) in item.tags.slice(0, 3)"
                            :key="i"
                            size="tiny"
                            type="info"
                        >
                            #{{ tag }}
                        </NTag>
                        <span v-if="item.tags.length > 3" class="more-tags">
                            +{{ item.tags.length - 3 }}
                        </span>
                    </NSpace>
                </div>

                <!-- 统计信息 -->
                <div class="card-stats">
                    <div v-if="item.noteNum > 0" class="stat-item">
                        <span class="stat-icon">📝</span>
                        <span class="stat-value">{{ item.noteNum }}</span>
                    </div>
                    <div v-if="item.senNum > 0" class="stat-item">
                        <span class="stat-icon">💬</span>
                        <span class="stat-value">{{ item.senNum }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">📅</span>
                        <span class="stat-value">{{ item.date }}</span>
                    </div>
                </div>

                <!-- 展开按钮 -->
                <div
                    v-if="item.noteNum + item.senNum > 0"
                    class="card-expand"
                    @click.stop="handleExpand(item)"
                >
                    <span>{{ t("View Details") }}</span>
                </div>
            </div>
        </NSpace>

        <!-- 展开详情模态框 -->
        <WordMore
            v-if="expandedWord"
            :word="expandedWord.expr"
            @close="expandedWord = null"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NTag, NButton, NSpace } from 'naive-ui';
import { t } from '@/lang/helper';
import { StatusColorMap } from '@/statusColors';
import WordMore from '@comp/WordMore.vue';

interface Row {
    expr: string;
    status: string;
    statusIndex: number;
    meaning: string;
    tags: string[];
    date: string;
    senNum: number;
    noteNum: number;
}

const props = defineProps<{
    data: Row[];
    isMobile: boolean;
}>();

const emit = defineEmits<{
    (e: 'edit', item: Row): void;
}>();

const expandedWord = ref<Row | null>(null);

const handleEdit = (item: Row) => {
    emit('edit', item);
};

const handleExpand = (item: Row) => {
    expandedWord.value = item;
};

const getStatusStyle = (statusIndex: number) => {
    const colorConfig = StatusColorMap[statusIndex];
    const color = colorConfig?.main || '#999';
    const bgColor = colorConfig?.bg || `${color}20`;
    const borderColor = colorConfig?.border || `${color}40`;

    return {
        backgroundColor: bgColor,
        color: color,
        border: `1px solid ${borderColor}`
    };
};
</script>

<style lang="scss" scoped>
.mobile-word-list {
    padding: 8px 0;

    .word-card {
        background: var(--n-card-color);
        border: 1px solid var(--n-border-color);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
            border-color: var(--n-primary-color);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;

            .word-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;

                .word-text {
                    font-size: 1.1em;
                    font-weight: bold;
                    color: var(--n-text-color);
                }
            }
        }

        .card-meaning {
            margin-bottom: 8px;
            padding: 8px;
            background: var(--n-modal-color);
            border-radius: 4px;

            .label {
                font-weight: bold;
                margin-right: 4px;
                color: var(--n-text-color-2);
            }

            .content {
                color: var(--n-text-color);
            }
        }

        .card-tags {
            margin-bottom: 8px;

            .label {
                font-weight: bold;
                margin-right: 8px;
                color: var(--n-text-color-2);
            }

            .more-tags {
                color: var(--n-text-color-3);
                font-size: 0.9em;
            }
        }

        .card-stats {
            display: flex;
            gap: 16px;
            padding-top: 8px;
            border-top: 1px solid var(--n-divider-color);

            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 0.9em;
                color: var(--n-text-color-2);

                .stat-icon {
                    font-size: 1.1em;
                }

                .stat-value {
                    color: var(--n-text-color);
                }
            }
        }

        .card-expand {
            text-align: center;
            margin-top: 8px;
            padding: 6px;
            background: var(--n-button-color-2);
            border-radius: 4px;
            color: var(--n-button-text-color-2);
            font-size: 0.9em;
            cursor: pointer;
            transition: background 0.2s;

            &:hover {
                background: var(--n-button-color-2-hover);
            }
        }
    }
}
</style>
