<template>
    <div class="action-buttons">
        <NSpace justify="end" :size="10">
            <NButton
                @click="$emit('addWord')"
                size="small"
                strong
                secondary
                type="info"
            >
                {{ t("Learning New Words") }}
            </NButton>

            <NButton
                @click="$emit('refresh')"
                size="small"
                strong
                secondary
                type="info"
            >
                {{ t("Refresh Word Database") }}
            </NButton>

            <NDropdown :options="exportOptions" @select="handleExport">
                <NButton
                    size="small"
                    strong
                    secondary
                    type="success"
                >
                    {{ t("Export") }}
                </NButton>
            </NDropdown>

            <NButton
                @click="$emit('resetFilters')"
                size="small"
                strong
                secondary
                type="warning"
                v-if="hasActiveFilters"
            >
                {{ t("Reset Filters") }}
            </NButton>
        </NSpace>
    </div>
</template>

<script setup lang="ts">
import { NSpace, NButton, NDropdown } from 'naive-ui';
import { t } from '@/lang/helper';
import type { DropdownMixedOption } from 'naive-ui';

const props = defineProps<{
    hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
    (e: 'addWord'): void;
    (e: 'refresh'): void;
    (e: 'resetFilters'): void;
    (e: 'export', format: 'csv' | 'json'): void;
}>();

const exportOptions: DropdownMixedOption[] = [
    {
        label: t('Export as CSV'),
        key: 'csv'
    },
    {
        label: t('Export as JSON'),
        key: 'json'
    }
];

const handleExport = (format: string) => {
    emit('export', format as 'csv' | 'json');
};
</script>

<style lang="scss" scoped>
.action-buttons {
    margin-bottom: 10px;
}
</style>
