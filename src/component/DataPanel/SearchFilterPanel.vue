<template>
    <div class="search-filter-panel">
        <!-- 搜索区域 -->
        <NSpace vertical :size="10">
            <!-- Expression 搜索 -->
            <div class="filter-row">
                <span class="filter-label">
                    {{ t("Word") }}:
                </span>
                <NInput
                    size="small"
                    :value="modelValue.expression"
                    @update:value="(val) => updateField('expression', val)"
                    :placeholder="t('Search by word...')"
                    clearable
                />
            </div>

            <!-- Meaning 搜索 -->
            <div class="filter-row">
                <span class="filter-label">
                    {{ t("Meaning") }}:
                </span>
                <NInput
                    size="small"
                    :value="modelValue.meaning"
                    @update:value="(val) => updateField('meaning', val)"
                    :placeholder="t('Search by meaning...')"
                    clearable
                />
            </div>

            <!-- Status 和 Type 筛选 -->
            <div class="filter-row filter-row-multiple">
                <span class="filter-label">
                    {{ t("Status") }}:
                </span>
                <NSelect
                    :value="modelValue.status"
                    @update:value="(val) => updateField('status', val)"
                    :options="statusOptions"
                    size="small"
                    style="width: 120px;"
                    clearable
                />

                <span class="filter-label" style="margin-left: 20px;">
                    {{ t("Type") }}:
                </span>
                <NSelect
                    :value="modelValue.t"
                    @update:value="(val) => updateField('t', val)"
                    :options="typeOptions"
                    size="small"
                    style="width: 120px;"
                    clearable
                />
            </div>
        </NSpace>
    </div>
</template>

<script setup lang="ts">
import { NInput, NSelect, NSpace } from 'naive-ui';
import { t } from '@/lang/helper';

const props = defineProps<{
    modelValue: {
        expression: string;
        meaning: string;
        status: number | undefined;
        t: string | undefined;
    };
    statusOptions: Array<{ label: string; value: number | undefined }>;
    typeOptions: Array<{ label: string; value: string | undefined }>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: typeof props.modelValue): void;
    (e: 'search'): void;
}>();

// 防抖搜索
let searchTimeout: NodeJS.Timeout | null = null;

const updateField = (field: keyof typeof props.modelValue, value: any) => {
    // 检查值是否真的改变了
    if (props.modelValue[field] === value) return;

    // 发出更新事件
    const newValue = {
        ...props.modelValue,
        [field]: value
    };
    emit('update:modelValue', newValue);

    // 触发搜索（带防抖）
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
        emit('search');
    }, 500);
};
</script>

<style lang="scss" scoped>
.search-filter-panel {
    .filter-row {
        display: grid;
        grid-template-columns: auto 2fr auto;
        align-items: center;
        gap: 10px;

        &.filter-row-multiple {
            grid-template-columns: auto auto auto auto auto auto;
        }

        .filter-label {
            display: inline-block;
            font-size: 1.1em;
            font-weight: bold;
            white-space: nowrap;
        }
    }
}
</style>
