<template>
    <div id="langr-data">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig">
            <div style="display:flex; align-items:center;">
                <span
                    style="display: inline-block; width: 70px; font-size: 1.2em; font-weight: bold; margin-right: 15px;">Search:</span>
                <NInput size="small" v-model:value="searchText" />
            </div>
            <NSpace style="margin: 10px 0;" align="center">
                <span
                    style="display: inline-block; width: 70px; font-size: 1.2em; font-weight: bold; margin-right: 5px;">
                    Tags:
                </span>
                <select v-model="mode">
                    <option value="and">And</option>
                    <option value="or">Or</option>
                </select>
                <NTag v-for="(tag, i) in tags" size="small" checkable v-model:checked="checkedTags[i]">
                    {{ "#" + tag }}
                </NTag>
            </NSpace>
            <NDataTable ref="table" size="small" :loading="loading" :data="data" :columns="collumns"
                :row-key="makeRowKey" @update:checked-row-keys="handleCheck" :pagination="{ pageSize: 10 }" />
        </NConfigProvider>
    </div>
</template>

<script setup lang="ts">
import { moment } from "obsidian";
import {
    h,
    ref,
    reactive,
    computed,
    watch,
    watchEffect,
    getCurrentInstance,
    Suspense,
    defineAsyncComponent,
} from "vue";
import {
    NConfigProvider,
    NDataTable,
    NTag,
    GlobalThemeOverrides,
    darkTheme,
    NSpace,
    NInput,
} from "naive-ui";
import { t } from "@/lang/helper";

import type { DataTableColumns, DataTableRowKey } from "naive-ui";
import type PluginType from "@/plugin";

const WordMore = defineAsyncComponent(() => import("@comp/WordMore.vue"));

const plugin = getCurrentInstance().appContext.config.globalProperties
    .plugin as PluginType;

const themeConfig: GlobalThemeOverrides = {
    DataTable: {
        fontSizeSmall: plugin.constants.platform === "mobile" ? "10px" : "14px",
        tdPaddingSmall: "8px",
    },
};

// 切换明亮/黑暗模式
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});


interface Row {
    expr: string;
    status: string;
    meaning: string;
    tags: string[];
    date: string;
    senNum: number;
    noteNum: number;
}

const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];


let loading = ref(true);
watchEffect(async () => {
    let rawData = await plugin.db.getAllExpressionSimple(false);
    data.value = rawData.map((entry, i): Row => {
        return {
            expr: entry.expression,
            status: statusMap[entry.status],
            meaning: entry.meaning,
            tags: entry.tags,
            noteNum: entry.note_num,
            senNum: entry.sen_num,
            date: moment.unix(entry.date).format("YYYY-MM-DD"),
        };
    });
    tags.value = await plugin.db.getTags();
    checkedTags.value = Array(tags.value.length).map((_) => false);
    loading.value = false;
});

let data = ref<Row[]>([]);

let table = ref<InstanceType<typeof NDataTable>>(null);
let mode = ref("and");
let tags = ref<string[]>([]);
let checkedTags = ref<boolean[]>([]);
let selectedTags = ref<string[]>([]);
watchEffect(() => {
    let selected = tags.value.filter((tag, i) => checkedTags.value[i]);
    table.value?.filter({
        tags: selected,
    });
    selectedTags.value = selected;
});

// 搜索框
let searchText = ref("");
watch(searchText, (text) => {
    table.value?.filter({
        expr: text
    });
});

// 选中行
let rowKeysRef = ref<DataTableRowKey[]>([]);
let makeRowKey = (row: Row) => row.expr;
function handleCheck(rowKeys: DataTableRowKey[]) {
    rowKeysRef.value = rowKeys;
}

let collumns = reactive<DataTableColumns<Row>>([
    // {
    //     type: "selection",
    // },
    {
        type: "expand",
        expandable: (row: Row) => row.noteNum + row.senNum > 0,
        renderExpand: (row: Row) => {
            return h(Suspense, [
                h(WordMore, { word: row.expr })
            ]);
        },
    },
    // 表达
    {
        title: "Expr",
        key: "expr",
        minWidth: 100,
        sorter: "default",
        filter(_, row) {
            if (!searchText.value) return true;

            return row.expr.contains(searchText.value);
        }
    },
    // 学习状态
    {
        title: "Status",
        key: "status",
        minWidth: 100,
        defaultFilterOptionValues: statusMap.slice(1),
        filterOptions: [
            { label: t("Ignore"), value: t("Ignore") },
            { label: t("Learning"), value: t("Learning") },
            { label: t("Familiar"), value: t("Familiar") },
            { label: t("Known"), value: t("Known") },
            { label: t("Learned"), value: t("Learned") },
        ],
        filter(value, row) {
            return row.status === value;
        },
    },
    // 含义
    {
        title: "Meaning",
        key: "meaning",
    },
    // 标签
    // {
    //     title: "Tags",
    //     key: "tags",
    //     minWidth: 100,
    //     render(row) {
    //         return row.tags.map((tag: string) =>
    //             h(
    //                 NTag,
    //                 {
    //                     style: { marginRight: "6px" },
    //                     type: "info",
    //                     size: "tiny",
    //                 },
    //                 { default: () => tag }
    //             )
    //         );
    //     },
    //     filter(value, row) {
    //         if (selectedTags.value.length === 0) {
    //             return true;
    //         }
    //         return mode.value === "and"
    //             ? selectedTags.value.every((tag) => row.tags.contains(tag))
    //             : selectedTags.value.some((tag) => row.tags.contains(tag));
    //     },
    // },
    // 修改日期
    {
        title: "Date",
        key: "date",
        minWidth: 100,
        sorter(row1, row2) {
            return moment.utc(row1.date).unix() - moment.utc(row2.date).unix();
        },
    },
]);


</script>

<style lang="scss">
#langr-data {
    #data-tags {
        display: flex;
    }

    .n-data-table-filter {
        width: 19px;
    }

    .n-data-table-th--filterable {
        width: 19px;

    }

    .n-data-table__pagination {
        justify-content: center;
    }

    .data-more {
        h2 {
            margin: 0.5em 0;
        }

        .data-notes {
            p {
                white-space: pre-line;
                margin: 0.5em 5px;
            }
        }

        .data-sens {
            .data-sen {
                margin-bottom: 5px;
                border: 1px solid gray;
                border-radius: 5px;

                p {
                    &:first-child {
                        font-style: italic;
                    }

                    margin: 0.5em 5px;
                }
            }
        }
    }
}
</style>
