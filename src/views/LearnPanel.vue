<template>
	<div id="langr-learn-panel">
		<NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
			<!-- <NThemeEditor> -->
			<NForm :model="model" label-placement="top" label-width="auto" :rules="rules"
				require-mark-placement="right-hanging">
				<!-- 一个单词或短语字符串 -->
				<NFormItem :label="t('Expression')" :label-style="labelStyle" path="expression">
					<NInput size="small" v-model:value="model.expression" :placeholder="t('A word or a phrase')" />
				</NFormItem>
				<!-- 词形还原提示（独立于 NFormItem，避免 feedback slot 在无校验消息时不渲染） -->
				<div v-if="lemmaToggle" class="lemma-hint">
					<span class="lemma-original">原文: {{ lemmaToggle.original }}</span>
					<NButton size="tiny" tertiary type="primary" @click="toggleLemma">
						{{
							(model.expression || '').toLowerCase() === lemmaToggle.lemma
								? '↩ 改回原文'
								: '↩ 改回原型'
						}}
					</NButton>
				</div>
				<!-- 单词或短语的含义(精简) -->
				<NFormItem :label="t('Meaning')" :label-style="labelStyle" path="meaning">
					<NInput size="small" v-model:value="model.meaning" :placeholder="t('A short definition')"
						type="textarea" autosize />
				</NFormItem>
				<!-- 类别，可以是Word或Phrase -->
				<NFormItem :label="t('Type')" :label-style="labelStyle" path="t">
					<NRadioGroup v-model:value="model.t">
						<NRadio value="WORD">{{ t("Word") }}</NRadio>
						<NRadio value="PHRASE">{{ t("Phrase") }}</NRadio>
					</NRadioGroup>
				</NFormItem>
				<!-- 当前单词的学习状态 -->
				<NFormItem :label="t('Status')" :label-style="labelStyle" path="status">
					<NRadioGroup v-model:value="model.status" size="small">
						<NRadioButton v-for="(s, i) in status" :value="i">
							{{ s.text }}
						</NRadioButton>
					</NRadioGroup>
				</NFormItem>
				<!-- 加一些tag, 可以用来搜索 -->
				<NFormItem :label="t('Tags')" :label-style="labelStyle" path="tags">
					<NSelect size="small" v-model:value="model.tags" filterable multiple tag
						:placeholder="t('Input or select some tags')" :loading="tagLoading" :options="tagOptions"
						@search="tagSearch"></NSelect>
				</NFormItem>
				<!-- 可选,可以记多条笔记 -->
				<NFormItem :label="t('Notes')" :label-style="labelStyle" path="tags">
					<NDynamicInput v-model:value="model.notes" :create-button-props="{ size: 'small' }">
						<template #create-button-default>
							{{ t("Create") }}
						</template>
						<template #="{ index, value }">
							<NInput size="small" type="textarea" :placeholder="t('Write a new note')"
								v-model:value="model.notes[index]" />
						</template>
					</NDynamicInput>
				</NFormItem>
				<!-- 可选,例句也可以记多条 -->
				<div style="margin-bottom: 8px">
					<label for="Sentences" :style="[labelStyle]">{{
						t("Sentences")
					}}</label>
				</div>
				<NDynamicInput v-model:value="model.sentences" :create-button-props="{ size: 'small' }"
					:on-create="onCreateSentence">
					<template #create-button-default>
						{{ t("Create") }}
					</template>
					<template #="{ index, value }">
						<div style="display: flex;
                                flex-direction: column;
                                flex: 1;
                                border: 2px solid gray;
                                border-radius: 3px;
                                padding: 3px;
                            ">
							<NFormItem :show-label="false" :path="`sentences[${index}].text`" :rule="sourceRule">
								<NInput size="small" type="textarea" v-model:value="model.sentences[index].text"
									:placeholder="t('Origin sentence')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
							<NFormItem :show-feedback="false" :show-label="false" :path="`sentences[${index}].trans`">
								<NInput size="small" type="textarea" v-model:value="model.sentences[index].trans"
									:placeholder="t('Translation (Optional)')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
							<NFormItem :show-feedback="false" :show-label="false" :path="`sentences[${index}].origin`">
								<NInput size="small" type="textarea" v-model:value="
									model.sentences[index].origin
								" :placeholder="t('Origin (Optional)')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
						</div>
					</template>
				</NDynamicInput>
			</NForm>
			<!-- 提交按钮 -->
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
			<!-- </NThemeEditor> -->
		</NConfigProvider>
	</div>
</template>

<script setup lang="ts">
import { Notice } from "obsidian";
import {
	ref,
	onMounted,
	onUnmounted,
	getCurrentInstance,
	computed,
	CSSProperties,
} from "vue";
import {
	NIcon,
	NIconWrapper,
	NForm,
	NFormItem,
	NInput,
	NRadio,
	NRadioButton,
	NRadioGroup,
	NButton,
	NDynamicInput,
	NSelect,
	SelectOption,
	NConfigProvider,
	// NThemeEditor,
	darkTheme,
	GlobalThemeOverrides,
} from "naive-ui";

import { ExpressionInfo, Sentence } from "@/db/interface";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import { tryLemmatize } from "@/utils/lemmatize";
import { LearnPanelView } from "./LearnPanelView";
import { ReadingView } from "./ReadingView";
import Plugin from "@/plugin";
import { search } from "@dict/youdao/engine";
import store from "@/store";

const view: LearnPanelView =
	getCurrentInstance().appContext.config.globalProperties.view;
const plugin: Plugin =
	getCurrentInstance().appContext.config.globalProperties.plugin;

// 切换明亮/黑暗模式
const theme = computed(() => {
	return store.dark ? darkTheme : null;
});

// 样式设置
const themeOverrides: GlobalThemeOverrides = {
	common: {},
	Form: {
		labelFontSizeTopMedium: "15px",
		feedbackFontSizeMedium: "13px",
		blankHeightMedium: "5px",
		feedbackHeightMedium: "22px",
	},
	Radio: {
		buttonBorderRadius: "5px",
		fontSizeMedium: "13px",
		fontSizeSmall: "13px",
		buttonHeightSmall: "22px",
	},
	Input: {
		fontSizeSmall: "12px",
		paddingSmall: "0 5px",
	},
	DynamicInput: {
		actionMargin: "0 0 0 5px",
	},
};

//表单数据
let model = ref<ExpressionInfo>({
	expression: null,
	meaning: null,
	status: 0,
	t: "WORD",
	tags: [],
	notes: [],
	sentences: [],
});

// 原型切换状态：用户从查词触发新增时，如果发生了词形还原，
// 存 { original, lemma }，用户点"改回原文/改回原型"按钮时整体切
let lemmaToggle = ref<{ original: string; lemma: string } | null>(null);

// 表单检查规则
let rules = {
	expression: {
		required: true,
		trigger: ["blur", "input"],
		message: t("Please input a word/phrase"),
	},
	meaning: {
		required: true,
		trigger: ["blur", "input"],
		message: t("A short definition is needed"),
	},
	t: {
		required: true,
		trigger: "change",
		message: "Expression can be a word or phrase",
	},
	status: {
		required: true,
	},
};

let sourceRule = {
	required: true,
	trigger: ["blur", "input"],
	message: "At least input a source sentence",
};

let labelStyle: CSSProperties = {
	// fontSize: "16px",
	fontWeight: "bold",
	// padding: "0 0 8px 2px",
};

function onCreateSentence() {
	return {
		text: "",
		trans: "",
		origin: "",
	};
}

// 单词状态样式
const status = [
	{ text: t("Ignore"), style: "" },
	{ text: t("Learning"), style: "background-Color: #ff980055" },
	{ text: t("Familiar"), style: "background-Color: #ffeb3c55" },
	{ text: t("Known"), style: "background-Color: #9eda5855" },
	{ text: t("Learned"), style: "background-Color: #4cb05155" },
];


// 异步获取数据库中所有tag
let tagOptions = ref<SelectOption[]>([]);
let tagLoading = ref(false);
let tags: string[] = [];

async function tagSearch(query: string) {
	tagLoading.value = true;
	if (query.length < 2) {
		tags = await plugin.db.getTags();
	}
	tagLoading.value = false;

	if (!query.length) {
		tagOptions.value = tags.map((v) => {
			return { label: v, value: v };
		});
		return;
	}
	tagOptions.value = tags
		.filter((v) => ~v.indexOf(query))
		.map((v) => {
			return { label: v, value: v };
		});
}

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
	// 表单内容检查
	if (!model.value.expression) {
		new Notice(t("Expression is empty!"));
		return;
	}
	if (!model.value.meaning) {
		new Notice(t("Meaning is empty!"));
		return;
	}
	if (
		model.value.expression.trim().split(" ").length > 1 &&
		model.value.t === "WORD"
	) {
		new Notice(t("It looks more like a PHRASE than a WORD"));
		return;
	}

	submitLoading.value = true;
	let data = JSON.parse(JSON.stringify(model.value));
	(data as any).expression = (data as any).expression.trim().toLowerCase();
	// 超过1条例句时，sentences中的对象会变成Proxy，尚不知原因，因此用JSON转换一下
	let statusCode = await plugin.db.postExpression(data);
	submitLoading.value = false;

	if (statusCode !== 200) {
		new Notice("Submit failed");
		console.warn("Submit failed, please check server status");
		fail();
		return;
	}
	
	success()

	dispatchEvent(
		new CustomEvent("obsidian-langr-refresh", {
			detail: {
				expression: model.value.expression,
				type: model.value.t,
				status: model.value.status,
			},
		})
	);
	dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

	//自动刷新数据库
	if (plugin.settings.auto_refresh_db) {
		// setTimeout(() => {
		plugin.refreshTextDB();
		// }, 0);
	}
}

// 查询词汇时自动填充新词表单
useEvent(window, "obsidian-langr-search", async (evt: CustomEvent) => {
	let selection = evt.detail.selection as string;

	// === 词形还原：ran → run / children → child / went → go / faster → fast ===
	// 只对单词（无空格）生效；短语保留原样
	// 多词或带空格的 selection 直接跳过
	let lemmaInfo: { lemma: string; changed: boolean; original: string } = {
		lemma: selection,
		changed: false,
		original: selection,
	};
	if (selection && !/\s/.test(selection.trim())) {
		lemmaInfo = tryLemmatize(selection);
	}
	const displayExpr = lemmaInfo.changed ? lemmaInfo.lemma : selection;

	// 用原型去数据库查重；如果库里已有 run，那即便用户点的是 ran，也应该加载 run 的记录
	let expr = await plugin.db.getExpression(displayExpr);

	let exprType = "WORD";
	if (displayExpr.trim().contains(" ")) {
		exprType = "PHRASE";
	}

	let target = evt.detail.target as HTMLElement;

	let sentenceText = "";
	let storedSen: Sentence = null;
	let defaultOrigin: string = null;
	let filledTrans = null;

	if (target) {
		let sentenceEl = target.parentElement.hasClass("stns")
			? target.parentElement
			: target.parentElement.parentElement;
		sentenceText = sentenceEl.textContent;

		storedSen = await plugin.db.tryGetSen(sentenceText);

		let reading = view.app.workspace.getActiveViewOfType(ReadingView);

		if (reading) {
			let presetOrigin = view.app.metadataCache.getFileCache(reading.file)
				.frontmatter["langr-origin"];
			defaultOrigin = presetOrigin ? presetOrigin : reading.file.name;
		}

		if (plugin.settings.use_machine_trans) {
			try {
				let res = await search(sentenceText);
				if (res && (res.result as any).translation) {
					let html = (res.result as any).translation as string;
					filledTrans =
						html
							.match(/<p>([^<>]+)<\/p>/g)[1]
							?.match(/<p>(.*)<\/p>/)[1] ?? null;
				}
			} catch (e) {
				filledTrans = "";
			}
		}
	}

	if (expr) {
		if (sentenceText) {
			if (!storedSen) {
				expr.sentences = expr.sentences.concat({
					text: sentenceText,
					trans: filledTrans,
					origin: defaultOrigin,
				});
			} else {
				let added = expr.sentences.find(
					(sen) => sen.text === sentenceText
				);
				if (!added) {
					expr.sentences = expr.sentences.concat(storedSen);
				}
			}
		}
		model.value = expr;
		// 库里已有记录（原型命中） — 保留切换按钮
		// 这样用户点 weighed 进来看到 weigh 这条已有记录时，
		// 还能切回 weighed（按 Save 会存一条新记录 weighed）
		lemmaToggle.value = lemmaInfo.changed
			? { original: lemmaInfo.original, lemma: lemmaInfo.lemma }
			: null;
		return;
	} else {
		// 发生了还原：记录 { original, lemma }，供切换按钮使用
		lemmaToggle.value = lemmaInfo.changed
			? { original: lemmaInfo.original, lemma: lemmaInfo.lemma }
			: null;

		if (!target) {
			model.value = {
				expression: displayExpr,
				meaning: "",
				status: 1,
				t: exprType,
				tags: [],
				notes: [],
				sentences: [],
			};
			return;
		}

		model.value = {
			expression: displayExpr,
			meaning: "",
			status: 1,
			t: exprType,
			tags: [],
			notes: [],
			sentences: storedSen
				? [storedSen]
				: [
					{
						text: sentenceText,
						trans: filledTrans,
						origin: defaultOrigin,
					},
				],
		};
	}
});

// 「改回原文 / 改回原型」切换 — 整体切回原值（只动 expression 字段，meaning/sentences 等保持）
function toggleLemma() {
	if (!lemmaToggle.value) return;
	const { original, lemma } = lemmaToggle.value;
	const current = (model.value.expression || "").toLowerCase();
	const target = current === lemma ? original : lemma;
	model.value.expression = target;
	// 通知另一面板（SearchPanel）一起切
	dispatchEvent(new CustomEvent("obsidian-langr-lemma-toggle", {
		detail: { source: "learn", word: target, original, lemma },
	}));
}

// 监听 SearchPanel 的切换事件 — 同步更新这边的 expression
const onLemmaToggleFromSearch = (evt: Event) => {
	const e = evt as CustomEvent;
	if (!e || !e.detail || e.detail.source === "learn") return;
	const { word: newWord, original, lemma } = e.detail as {
		source: string; word: string; original: string; lemma: string;
	};
	if (!newWord) return;
	model.value.expression = newWord;
	lemmaToggle.value = { original, lemma };
};

// 注册跨面板联动监听（learn → search 方向）
useEvent(window, "obsidian-langr-lemma-toggle", onLemmaToggleFromSearch);

</script>

<style lang="scss">
#langr-learn-panel {
	padding-bottom: 18px;

	.n-input {
		margin: 1px 0;
	}

	.n-dynamic-input .n-button-group {
		flex-direction: column;

		button {
			height: 26px;
			width: 26px;

			&:nth-child(1) {
				border-top-left-radius: 34px !important;
				border-top-right-radius: 34px !important;
				border-bottom-left-radius: 0 !important;
				border-bottom-right-radius: 0 !important;
			}

			&:nth-child(2) {
				border-top-left-radius: 0 !important;
				border-top-right-radius: 0 !important;
				border-bottom-left-radius: 34px !important;
				border-bottom-right-radius: 34px !important;
			}
		}
	}

	// 词形还原提示
	.lemma-hint {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-muted);

		.lemma-original {
			font-style: italic;
		}
	}
}
</style>