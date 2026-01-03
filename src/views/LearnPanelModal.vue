<template>
  <div>
    <NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
      <NMessageProvider>
        <NModal
          :show="props.show"
          @update:show="handleShowChange"
          :mask-closable="false"
          preset="dialog"
          :title="t('Learning New Words')"
          class="learn-panel-modal"
          :style="{ width: '700px', maxWidth: '95vw' }"
        >
          <div id="langr-learn-panel-modal">
            <LearnPanelForm :model="model">
              <template #action>
                <div class="form-actions">
                  <NSpace vertical :size="12">
                    <NButton
                      type="primary"
                      size="medium"
                      attr-type="submit"
                      @click="submit"
                      :loading="submitLoading"
                      class="submit-button"
                    >
                      <template #icon>
                        <span style="font-size: 1.1em">✓</span>
                      </template>
                      {{ t("Submit") }}
                    </NButton>
                  </NSpace>
                </div>
              </template>
            </LearnPanelForm>
          </div>
        </NModal>
      </NMessageProvider>
    </NConfigProvider>
  </div>
</template>

<script setup lang="ts">
import { darkTheme, NButton, NConfigProvider, NModal, NSpace, NMessageProvider } from "naive-ui";
import { ExpressionInfo } from "@/storage/interface";
import { computed, PropType, watch, getCurrentInstance, ref } from "vue";
import { t } from "@/lang/helper";
import { Notice } from "obsidian";
import Plugin from "@/plugin";
import store from "@/store";
import { useLearn } from "./useLearn";
import LearnPanelForm from "./LearnPanelForm.vue";

const emit = defineEmits(["onChangeShow", "onChangeWord"]);

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  word: {
    type: Object as PropType<ExpressionInfo>,
    required: true,
  },
});

const { model, themeOverrides, plugin, submit: submitForm } = useLearn();

// 处理模态框显示状态变化
const handleShowChange = (value: boolean) => {
    emit("onChangeShow", value);
};

watch(
  () => props.show,
  (newValue) => {
    if (newValue === false) {
      emit("onChangeShow", newValue);
    }
  }
);
watch(
  () => props.word,
  (newValue) => {
    // 防止重复
    model.value = JSON.parse(JSON.stringify(newValue));
  }
);

// 切换明亮/黑暗模式
const theme = computed(() => {
  return store.dark ? darkTheme : null;
});

// 提交信息到数据库的加载状态
let submitLoading = ref(false);

async function submit() {
  submitLoading.value = true;
  const res = await submitForm(props.word.expression);
  submitLoading.value = false;

  if (res) {
    emit("onChangeShow", false);
    emit("onChangeWord", model);
  }
}
</script>

<style lang="scss">
.learn-panel-modal {
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  // 模态框标题样式
  .n-dialog__title {
    font-size: 18px;
    font-weight: 600;
  }

  // 内容区域
  .n-dialog__content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 0;
    max-height: calc(85vh - 150px);

    // 完全隐藏滚动条
    &::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }

    // Firefox 隐藏滚动条
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  // 底部操作栏
  .n-dialog__action {
    padding: 16px 24px;
    border-top: 1px solid var(--n-divider-color);
    background: var(--n-color-modal);
  }
}

#langr-learn-panel-modal {
  .form-actions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px dashed var(--n-divider-color);

    .submit-button {
      width: 100%;
      height: 42px;
      font-size: 15px;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(var(--n-primary-color-rgb), 0.3);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }
}
</style>
