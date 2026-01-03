<template>
    <div class="word-card-list">
        <!-- 使用 CSS Grid 实现响应式布局 -->
        <TransitionGroup name="list" tag="div" class="card-grid">
            <div
                v-for="item in data"
                :key="item.expr"
                class="word-card"
                @click="handleCardClick(item)"
            >
                <!-- 单词和状态 -->
                <div class="card-header">
                    <div class="word-info">
                        <span class="word-text" :title="item.expr">{{ item.expr }}</span>
                        <NTag
                            size="small"
                            :style="getStatusStyle(item.statusIndex)"
                        >
                            {{ item.status }}
                        </NTag>
                    </div>
                    <div class="action-buttons">
                        <NButton
                            size="tiny"
                            type="info"
                            secondary
                            @click.stop="handleEdit(item)"
                        >
                            {{ t("Edit") }}
                        </NButton>
                        <NButton
                            v-if="item.noteNum + item.senNum > 0"
                            size="tiny"
                            type="default"
                            @click.stop="handleViewDetails(item)"
                        >
                            {{ t("Details") }}
                        </NButton>
                    </div>
                </div>

                <!-- 含义 -->
                <div v-if="item.meaning" class="card-meaning">
                    <span class="label">{{ t("Meaning") }}:</span>
                    <span class="content">{{ item.meaning }}</span>
                </div>

                <!-- 标签 -->
                <div v-if="item.tags && item.tags.length > 0" class="card-tags">
                    <NSpace :size="6" :wrap="true">
                        <NTag
                            v-for="(tag, i) in item.tags.slice(0, 4)"
                            :key="i"
                            size="small"
                            type="info"
                            :bordered="false"
                        >
                            #{{ tag }}
                        </NTag>
                        <NTag
                            v-if="item.tags.length > 4"
                            size="small"
                            type="default"
                            :bordered="false"
                        >
                            +{{ item.tags.length - 4 }}
                        </NTag>
                    </NSpace>
                </div>

                <!-- 统计信息 -->
                <div class="card-stats">
                    <div v-if="item.noteNum > 0" class="stat-item" :title="t('Notes')">
                        <span class="stat-icon">📝</span>
                        <span class="stat-value">{{ item.noteNum }}</span>
                    </div>
                    <div v-if="item.senNum > 0" class="stat-item" :title="t('Sentences')">
                        <span class="stat-icon">💬</span>
                        <span class="stat-value">{{ item.senNum }}</span>
                    </div>
                    <div class="stat-item" :title="t('Added Date')">
                        <span class="stat-icon">📅</span>
                        <span class="stat-value">{{ formatDate(item.date) }}</span>
                    </div>
                </div>
            </div>
        </TransitionGroup>

        <!-- 展开详情模态框 -->
        <WordMoreModal
            :word="currentWord?.expr || ''"
            :show="showModal"
            @update:show="showModal = false"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NTag, NButton, NSpace } from 'naive-ui';
import { t } from '@/lang/helper';
import { StatusColorMap } from '@/statusColors';
import WordMoreModal from '@/component/WordMoreModal.vue';
import { moment } from 'obsidian';

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
}>();

const emit = defineEmits<{
    (e: 'edit', item: Row): void;
}>();

const showModal = ref(false);
const currentWord = ref<Row | null>(null);

// 缓存状态颜色映射，避免重复计算
const statusStyleCache = new Map<number, ReturnType<typeof getStatusStyle>>();

const handleEdit = (item: Row) => {
    emit('edit', item);
};

const handleViewDetails = (item: Row) => {
    console.log("========== [WordCardList] handleViewDetails called ==========");
    console.log("item:", JSON.stringify(item, null, 2));
    console.log("item.expr:", item.expr);
    console.log("item.noteNum:", item.noteNum, "item.senNum:", item.senNum);

    currentWord.value = item;
    showModal.value = true;

    console.log("After setting:");
    console.log("  - currentWord.value:", currentWord.value);
    console.log("  - showModal.value:", showModal.value);
    console.log("  - currentWord.value?.expr:", currentWord.value?.expr);
    console.log("========== [WordCardList] handleViewDetails end ==========\n");
};

// 卡片点击处理：点击卡片本身也能查看详情
const handleCardClick = (item: Row) => {
    handleViewDetails(item);
};

const getStatusStyle = (statusIndex: number) => {
    // 检查缓存
    if (statusStyleCache.has(statusIndex)) {
        return statusStyleCache.get(statusIndex)!;
    }

    // 计算并缓存
    const colorConfig = StatusColorMap[statusIndex];
    const color = colorConfig?.main || '#999';
    const bgColor = colorConfig?.bg || `${color}20`;
    const borderColor = colorConfig?.border || `${color}40`;

    const style = {
        backgroundColor: bgColor,
        color: color,
        border: `1px solid ${borderColor}`
    };

    statusStyleCache.set(statusIndex, style);
    return style;
};

// 格式化日期显示
const formatDate = (dateStr: string) => {
    if (!dateStr) return '';

    const date = moment(dateStr, 'YYYY-MM-DD');
    const now = moment();
    const diffDays = now.diff(date, 'days');

    // 如果是今天，显示"Today"
    if (diffDays === 0) {
        return t('Today');
    }
    // 如果是昨天，显示"Yesterday"
    else if (diffDays === 1) {
        return t('Yesterday');
    }
    // 如果是本周内，显示星期几
    else if (diffDays < 7) {
        return date.format('ddd');
    }
    // 否则显示简短日期
    else {
        return date.format('MM/DD');
    }
};
</script>

<style lang="scss" scoped>
.word-card-list {
    padding: 10px 0;

    .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
        width: 100%;
        position: relative;
    }

    .word-card {
        background: var(--n-card-color);
        border: 1px solid var(--n-border-color);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        overflow: hidden;
        min-height: 180px; // 固定最小高度，避免分页时抖动
        cursor: pointer; // 添加指针光标，提示可点击

        // 添加微妙的进入动画
        animation: card-enter 0.3s ease-out;

        // 增强的 hover 效果
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        // 增强深色模式下的边框和阴影
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08),
                    0 1px 3px rgba(0, 0, 0, 0.05);

        // 使用伪元素增强边框效果（深色模式下更明显）
        &::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 8px;
            padding: 1px;
            background: linear-gradient(
                to bottom,
                rgba(128, 128, 128, 0.1),
                rgba(128, 128, 128, 0.05)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            opacity: 0.6;
        }

        &:hover {
            border-color: var(--n-primary-color);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
                        0 2px 6px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);

            // hover 时增强伪元素边框
            &::before {
                opacity: 1;
                background: linear-gradient(
                    to bottom,
                    rgba(var(--n-primary-color-rgb), 0.2),
                    rgba(var(--n-primary-color-rgb), 0.1)
                );
            }

            .word-text {
                color: var(--n-primary-color);
            }
        }

        // 点击反馈
        &:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        // 深色模式下的特殊样式
        :global(body.dark-mode) & {
            background: linear-gradient(
                to bottom,
                rgba(40, 40, 40, 0.8),
                rgba(35, 35, 35, 0.9)
            );
            border-color: rgba(128, 128, 128, 0.3);
            box-shadow:
                0 2px 8px rgba(0, 0, 0, 0.3),
                0 1px 3px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);

            &::before {
                opacity: 0.8;
                background: linear-gradient(
                    to bottom,
                    rgba(128, 128, 128, 0.2),
                    rgba(128, 128, 128, 0.1)
                );
            }

            &:hover {
                border-color: rgba(128, 128, 128, 0.5);
                box-shadow:
                    0 4px 12px rgba(0, 0, 0, 0.4),
                    0 2px 6px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08);

                &::before {
                    background: linear-gradient(
                        to bottom,
                        rgba(var(--n-primary-color-rgb), 0.3),
                        rgba(var(--n-primary-color-rgb), 0.2)
                    );
                }
            }
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;

            .word-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                flex-wrap: wrap;
                min-width: 0; // 防止 flex 子元素溢出

                .word-text {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--n-text-color);
                    transition: color 0.2s;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 100%;
                }
            }

            .action-buttons {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
                align-items: center;
            }
        }

        .card-meaning {
            padding: 10px 12px;
            background: var(--n-modal-color);
            border-radius: 6px;
            border-left: 3px solid var(--n-primary-color);
            transition: all 0.2s;
            flex-shrink: 0;
            position: relative;
            font-size: 0.95em;

            // 增强深色模式下的对比度
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);

            &:hover {
                background: var(--n-color-target);
            }

            .label {
                font-weight: 600;
                margin-right: 8px;
                color: var(--n-text-color-2);
                font-size: 0.9em;
                display: inline;
            }

            .content {
                color: var(--n-text-color);
                line-height: 1.6;
                word-break: break-word;
                display: inline;
            }

            // 深色模式下的优化
            :global(body.dark-mode) & {
                background: linear-gradient(
                    to right,
                    rgba(60, 60, 60, 0.6),
                    rgba(50, 50, 50, 0.4)
                );
                border-left-color: var(--n-primary-color);
                box-shadow:
                    inset 0 1px 2px rgba(0, 0, 0, 0.15),
                    inset 0 -1px 0 rgba(255, 255, 255, 0.03);

                &:hover {
                    background: linear-gradient(
                        to right,
                        rgba(70, 70, 70, 0.7),
                        rgba(60, 60, 60, 0.5)
                    );
                }
            }
        }

        .card-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;

            .more-tags {
                color: var(--n-text-color-3);
                font-size: 0.9em;
            }
        }

        .card-stats {
            display: flex;
            gap: 12px;
            padding-top: 10px;
            margin-top: auto;
            border-top: 1px solid var(--n-divider-color);
            flex-wrap: wrap;

            // 增强分隔线的可见度
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);

            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 0.85em;
                color: var(--n-text-color-2);
                transition: all 0.2s;
                padding: 3px 8px;
                border-radius: 12px;
                background: var(--n-color-modal);

                &:hover {
                    color: var(--n-primary-color);
                    background: var(--n-color-target);

                    .stat-icon {
                        transform: scale(1.1);
                    }
                }

                .stat-icon {
                    font-size: 1.15em;
                    transition: transform 0.2s;
                }

                .stat-value {
                    color: var(--n-text-color);
                    font-weight: 500;
                }
            }

            // 深色模式下的优化
            :global(body.dark-mode) & {
                border-top-color: rgba(128, 128, 128, 0.2);
                box-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.02);

                .stat-item {
                    background: rgba(60, 60, 60, 0.4);

                    &:hover {
                        background: rgba(80, 80, 80, 0.5);
                    }

                    .stat-value {
                        color: rgba(255, 255, 255, 0.9);
                    }
                }
            }
        }
    }
}

// 列表过渡动画 (TransitionGroup)
.list-enter-active,
.list-leave-active {
    transition: all 0.3s ease;
}

.list-enter-from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
}

.list-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

.list-move {
    transition: transform 0.3s ease;
}

/* 确保离开的元素脱离文档流，实现平滑的布局动画 */
.list-leave-active {
    position: absolute;
    width: 100%;
    z-index: 0;
}

// 卡片进入动画
@keyframes card-enter {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
</style>
