<template>
    <div class="tag-filter" v-if="tags.length > 0">
        <NSpace align="center" :size="10">
            <span class="tag-label">
                {{ t("Tags") }}:
            </span>

            <NSpace :size="10" align="center">
                <!-- And/Or 模式选择 -->
                <NSelect
                    :value="mode"
                    @update:value="updateMode"
                    :options="modeOptions"
                    size="small"
                    style="width: 80px;"
                />

                <!-- 标签列表 -->
                <NSpace :size="6" :wrap="true">
                    <NTag
                        v-for="(tag, i) in tags"
                        :key="i"
                        size="small"
                        :checkable="true"
                        :checked="checkedTags[i]"
                        @update:checked="(val) => updateTag(i, val)"
                        :type="checkedTags[i] ? 'info' : 'default'"
                    >
                        {{ "#" + tag }}
                    </NTag>
                </NSpace>
            </NSpace>
        </NSpace>
    </div>
</template>

<script setup lang="ts">
import { NTag, NSelect, NSpace } from 'naive-ui';
import { t } from '@/lang/helper';

const props = defineProps<{
    tags: string[];
    checkedTags: boolean[];
    mode: 'and' | 'or';
}>();

const emit = defineEmits<{
    (e: 'update:checkedTags', value: boolean[]): void;
    (e: 'update:mode', value: 'and' | 'or'): void;
}>();

const modeOptions = [
    { label: 'And', value: 'and' },
    { label: 'Or', value: 'or' }
];

const updateTag = (index: number, value: boolean) => {
    // 检查值是否真的改变了
    if (props.checkedTags[index] === value) return;

    // 创建新的数组
    const newCheckedTags = [...props.checkedTags];
    newCheckedTags[index] = value;

    // 发出更新事件
    emit('update:checkedTags', newCheckedTags);
};

const updateMode = (value: 'and' | 'or') => {
    // 检查值是否真的改变了
    if (props.mode === value) return;

    // 发出更新事件
    emit('update:mode', value);
};
</script>

<style lang="scss" scoped>
.tag-filter {
    margin: 10px 0;

    .tag-label {
        display: inline-block;
        font-size: 1.1em;
        font-weight: bold;
        white-space: nowrap;
    }
}
</style>
