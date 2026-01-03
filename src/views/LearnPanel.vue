<template>
	<div id="langr-learn-panel-container">
		<LearnPanelForm :model="model">
			<template #action>
				<div style="margin-top: 10px">
					<NButton size="small" style="--n-width: 100%" attr-type="submit" @click="submit"
						:loading="submitLoading">
						<NIconWrapper v-if="successing" :size="18" :border-radius="6" style="margin-right: 6px;">
							<NIcon :size="16">
								<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16">
									<g fill="none">
										<path d="M14.046 3.486a.75.75 0 0 1-.032 1.06l-7.93 7.474a.85.85 0 0 1-1.188-.022l-2.68-2.72a.75.75 0 1 1 1.068-1.053l2.234 2.267l7.468-7.038a.75.75 0 0 1 1.06.032z" fill="currentColor">
										</path>
									</g>
								</svg>
							</NIcon>
						</NIconWrapper>
						<NIconWrapper v-if="failing" :size="18" :border-radius="6" style="margin-right: 6px;" color="#DE5959">
							<NIcon :size="16">
								<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16">
									<g fill="none">
										<path d="M2.397 2.554l.073-.084a.75.75 0 0 1 .976-.073l.084.073L8 6.939l4.47-4.47a.75.75 0 1 1 1.06 1.061L9.061 8l4.47 4.47a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L8 9.061l-4.47 4.47a.75.75 0 0 1-1.06-1.061L6.939 8l-4.47-4.47a.75.75 0 0 1-.072-.976l.073-.084l-.073.084z" fill="currentColor">
										</path>
									</g>
								</svg>
							</NIcon>
						</NIconWrapper>
						
						{{ t("Submit") }}
					</NButton>
				</div>
			</template>
		</LearnPanelForm>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
	NIcon,
	NIconWrapper,
	NButton,
} from "naive-ui";

import { t } from "@/lang/helper";
import { useLearn, useSearchListener } from "./useLearn";
import LearnPanelForm from "./LearnPanelForm.vue";

const { model, plugin, view, submit: submitForm } = useLearn();

// 注册搜索事件监听
useSearchListener(model, plugin, view);

// 提交信息到数据库的加载状态
let successing = ref(false);
async function success() {
	successing.value = true;
	await sleep(2000)
	successing.value = false;
}
let failing = ref(false);
async function fail() {
	failing.value = true;
	await sleep(2000)
	failing.value = false;
}

let submitLoading = ref(false);

async function submit() {
	submitLoading.value = true;
	const res = await submitForm();
	submitLoading.value = false;

	if (res) {
		success();
	} else {
		fail();
	}
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
</script>

<style lang="scss">
#langr-learn-panel-container {
    /* Styles are now in LearnPanelForm, but we can keep container styles here if needed */
}
</style>

