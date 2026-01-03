<template>
    <div class="learn-panel-form">
        <NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
            <NForm
                :model="model"
                label-placement="top"
                label-width="auto"
                :rules="rules"
                require-mark-placement="right-hanging"
                class="word-form"
            >
                <!-- Expression -->
                <NFormItem :label="t('Expression')" :label-style="labelStyle" path="expression">
                    <NInput
                        size="medium"
                        v-model:value="model.expression"
                        :placeholder="t('A word or a phrase')"
                        @input="onExpressionInput"
                    />
                </NFormItem>

                <!-- Meaning -->
                <NFormItem :label="t('Meaning')" :label-style="labelStyle" path="meaning">
                    <NInput
                        size="medium"
                        v-model:value="model.meaning"
                        :placeholder="t('A short definition')"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 4 }"
                    />
                </NFormItem>

                <!-- Type -->
                <NFormItem :label="t('Type')" :label-style="labelStyle" path="t">
                    <NRadioGroup v-model:value="model.t" size="medium">
                        <NSpace :size="16">
                            <NRadio value="WORD">{{ t("Word") }}</NRadio>
                            <NRadio value="PHRASE">{{ t("Phrase") }}</NRadio>
                        </NSpace>
                    </NRadioGroup>
                </NFormItem>

                <!-- Status -->
                <NFormItem :label="t('Status')" :label-style="labelStyle" path="status">
                    <NRadioGroup v-model:value="model.status" size="medium">
                        <NRadioButton v-for="(s, i) in statusOptions" :value="i" :key="i">
                            {{ s.text }}
                        </NRadioButton>
                    </NRadioGroup>
                </NFormItem>

                <!-- Tags -->
                <NFormItem :label="t('Tags')" :label-style="labelStyle" path="tags">
                    <NSelect
                        size="medium"
                        v-model:value="model.tags"
                        filterable
                        multiple
                        tag
                        :placeholder="t('Input or select some tags')"
                        :loading="tagLoading"
                        :options="tagOptions"
                        @search="tagSearch"
                    />
                </NFormItem>

                <!-- Notes -->
                <NFormItem :label="t('Notes')" :label-style="labelStyle" path="notes">
                    <NDynamicInput
                        v-model:value="model.notes"
                        :create-button-props="{ size: 'medium' }"
                        class="notes-dynamic-input"
                    >
                        <template #create-button-default>
                            {{ t("Add Note") }}
                        </template>
                        <template v-slot="{ index }">
                            <NInput
                                size="medium"
                                type="textarea"
                                :placeholder="t('Write a new note')"
                                v-model:value="model.notes[index]"
                                :autosize="{ minRows: 2, maxRows: 5 }"
                            />
                        </template>
                    </NDynamicInput>
                </NFormItem>

                <!-- Sentences -->
                <div class="sentences-section">
                    <label :style="labelStyle" class="section-label">{{ t("Sentences") }}</label>
                    <NDynamicInput
                        v-model:value="model.sentences"
                        :create-button-props="{ size: 'medium' }"
                        :on-create="onCreateSentence"
                        class="sentences-dynamic-input"
                    >
                        <template #create-button-default>
                            {{ t("Add Sentence") }}
                        </template>
                        <template v-slot="{ index }">
                            <div class="sentence-item">
                                <NFormItem
                                    :show-label="false"
                                    :show-feedback="false"
                                    :path="`sentences[${index}].sentence`"
                                    :rule="sourceRule"
                                >
                                    <NInput
                                        size="medium"
                                        type="textarea"
                                        v-model:value="model.sentences[index].sentence"
                                        :placeholder="t('Origin sentence')"
                                        :autosize="{ minRows: 2, maxRows: 4 }"
                                    />
                                </NFormItem>
                                <NFormItem
                                    :show-feedback="false"
                                    :show-label="false"
                                    :path="`sentences[${index}].trans`"
                                >
                                    <NInput
                                        size="medium"
                                        type="textarea"
                                        v-model:value="model.sentences[index].trans"
                                        :placeholder="t('Translation (Optional)')"
                                        :autosize="{ minRows: 1, maxRows: 3 }"
                                    />
                                </NFormItem>
                                <NFormItem
                                    :show-feedback="false"
                                    :show-label="false"
                                    :path="`sentences[${index}].origin`"
                                >
                                    <NInput
                                        size="medium"
                                        type="textarea"
                                        v-model:value="model.sentences[index].origin"
                                        :placeholder="t('Origin (Optional)')"
                                        :autosize="{ minRows: 1, maxRows: 3 }"
                                    />
                                </NFormItem>
                            </div>
                        </template>
                    </NDynamicInput>
                </div>
            </NForm>

            <slot name="action"></slot>
        </NConfigProvider>
    </div>
</template>

<script setup lang="ts">
import { PropType, computed } from "vue";
import {
    NConfigProvider,
    NForm,
    NFormItem,
    NInput,
    NRadio,
    NRadioButton,
    NRadioGroup,
    NSelect,
    NDynamicInput,
    NSpace,
    darkTheme
} from "naive-ui";
import { t } from "@/lang/helper";
import { useLearn } from "./useLearn";
import store from "@/store";
import { ExpressionInfo } from "@/storage/interface";

const props = defineProps({
    model: {
        type: Object as PropType<ExpressionInfo>,
        required: true
    }
});

const {
    rules,
    sourceRule,
    labelStyle,
    statusOptions,
    themeOverrides,
    onCreateSentence,
    tagOptions,
    tagLoading,
    tagSearch
} = useLearn();

// Theme logic
const theme = computed(() => {
    return store.dark ? darkTheme : null;
});

// 输入单词时自动转小写
const onExpressionInput = (value: string) => {
    if (value && model.value.t === 'WORD') {
        model.value.expression = value.toLowerCase();
    }
};
</script>

<style lang="scss">
.learn-panel-form {
    padding: 8px 0;

    .word-form {
        // 基础表单项间距
        .n-form-item {
            margin-bottom: 20px;

            &:last-child {
                margin-bottom: 0;
            }
        }

        // 标签样式
        .n-form-item-label {
            font-weight: 600;
            font-size: 13px;
            color: var(--n-text-color-2);
            margin-bottom: 6px;
        }
    }

    // 句子区域
    .sentences-section {
        margin-top: 8px;

        .section-label {
            display: block;
            font-weight: 600;
            font-size: 13px;
            color: var(--n-text-color-2);
            margin-bottom: 12px;
        }
    }

    // 句子卡片样式
    .sentence-item {
        display: flex;
        flex-direction: column;
        gap: 0;
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        width: 100%;

        .n-form-item {
            margin-bottom: 12px !important;
            width: 100%;

            &:last-child {
                margin-bottom: 0 !important;
            }

            // 确保输入框占满宽度
            :deep(.n-form-item-blank) {
                width: 100%;
            }

            :deep(.n-input) {
                width: 100%;
                margin: 0;
            }
        }
    }

    // 动态输入项样式
    .notes-dynamic-input,
    .sentences-dynamic-input {
        .n-dynamic-input-item {
            width: 100%;
            margin-bottom: 12px;

            :deep(.n-dynamic-input-item__blank) {
                width: 100%;
            }
        }
    }

    // 输入框样式优化
    .n-input,
    .n-select {
        transition: all 0.2s ease;

        &:hover {
            border-color: var(--n-primary-color);
        }

        &:focus-within {
            box-shadow: 0 0 0 2px rgba(var(--n-primary-color-rgb), 0.1);
        }
    }

    // 文本域样式
    .n-input__textarea-el {
        line-height: 1.6;
    }
}
</style>
