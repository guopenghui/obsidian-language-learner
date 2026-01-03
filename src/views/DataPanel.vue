<template>
    <div id="langr-data">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig.value">
            <NMessageProvider>
                <!-- 操作按钮 -->
                <ActionButtons
                :has-active-filters="hasActiveFilters"
                @add-word="onAddWord"
                @refresh="refresh"
                @reset-filters="resetFilters"
                @export="handleExport"
            />

            <!-- 搜索和筛选面板 -->
            <div class="search-section">
                <SearchFilterPanel
                    v-model="searchParams"
                    :status-options="statusOptions"
                    :type-options="typeOptions"
                    @search="onSearchChange"
                />
            </div>

            <!-- 标签筛选 -->
            <div class="tag-section">
                <TagFilter
                    v-model:checked-tags="checkedTags"
                    v-model:mode="mode"
                    :tags="tags"
                />
            </div>

            <!-- 加载状态 -->
            <div class="content-container scroll-container" ref="scrollContainer">
                <NSpin :show="loading">
                    <!-- 错误状态 -->
                    <div v-if="!loading && error" class="empty-state">
                        <div class="empty-icon">❌</div>
                        <div class="empty-description">{{ error }}</div>
                        <div class="empty-actions">
                            <NSpace>
                                <NButton type="primary" @click="retryLoad">
                                    {{ t("Retry") }}
                                </NButton>
                                <NButton @click="resetFilters">
                                    {{ t("Reset Filters") }}
                                </NButton>
                            </NSpace>
                        </div>
                    </div>

                    <!-- 空状态 -->
                    <div v-else-if="!loading && filteredData.length === 0" class="empty-state">
                        <div class="empty-icon">📚</div>
                        <div class="empty-description">
                            {{ data.length === 0 ? t('No words found. Try adjusting your filters.') : t('No words match the selected tags.') }}
                        </div>
                        <div class="empty-actions" v-if="hasActiveFilters">
                            <NButton @click="resetFilters">
                                {{ t("Reset Filters") }}
                            </NButton>
                        </div>
                    </div>

                    <!-- 卡片列表视图 -->
                    <div v-else class="card-list-section">
                    <!-- 筛选结果提示 -->
                    <div v-if="filteredData.length !== data.length" class="filter-info">
                        <NText>
                            {{ t("Showing {0} of {1} words", filteredData.length, data.length) }}
                        </NText>
                    </div>

                    <WordCardList
                        :data="data"
                        @edit="handleEditWord"
                    />

                    <!-- 加载更多提示 -->
                    <div v-if="!loading && hasMore && data.length > 0" class="load-more-section">
                        <NSpin :show="loadingMore" size="small">
                            <div class="load-more-text">
                                {{ loadingMore ? t("Loading...") : t("Scroll down to load more") }}
                            </div>
                        </NSpin>
                    </div>

                    <!-- 没有更多数据提示 -->
                    <div v-if="!loading && !hasMore && data.length > 0" class="no-more-section">
                        <NText depth="3">
                            {{ t("No more data") }}
                        </NText>
                    </div>
                </div>
            </NSpin>
            </div>
            </NMessageProvider>
        </NConfigProvider>

        <LearnPanelModal @onChangeWord="onChangeWord" @on-change-show="onChangeShow" :show="showWordModal" :word="word"/>
    </div>
</template>

<script setup lang="ts">
import {moment, Notice} from "obsidian";
import {
    ref,
    computed,
    watch,
    getCurrentInstance,
    onMounted,
    onBeforeUnmount,
} from "vue";
import {
    NConfigProvider,
    NButton,
    NSpin,
    NEmpty,
    NText,
    NSpace,
    GlobalThemeOverrides,
    darkTheme,
    NMessageProvider,
} from "naive-ui";
import {t} from "@/lang/helper";

import type PluginType from "@/plugin";
import LearnPanelModal from "@/views/LearnPanelModal.vue";
import { StatusColorMap } from "@/statusColors";

// 导入拆分的子组件
import ActionButtons from "@/component/DataPanel/ActionButtons.vue";
import SearchFilterPanel from "@/component/DataPanel/SearchFilterPanel.vue";
import TagFilter from "@/component/DataPanel/TagFilter.vue";
import WordCardList from "@/component/DataPanel/WordCardList.vue";

const plugin = getCurrentInstance().appContext.config.globalProperties
    .plugin as PluginType;

const themeConfig = computed<GlobalThemeOverrides>(() => ({
    // 统一字体大小
    common: {
        fontSize: '14px',
    },
}));

const loading = ref(true);
const error = ref<string | null>(null);
const retryCount = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);
const loadingMore = ref(false);
const currentPage = ref(0);
const pageSize = ref(20);
const hasMore = ref(true); // 是否还有更多数据

// 用户偏好设置的键名
const PREFS_KEY = 'datapanel-prefs';

// 保存用户偏好
const savePrefs = () => {
    const prefs = {
        sort: {
            field: sortParams.value.field,
            order: sortParams.value.order
        },
        search: {
            expression: searchParams.value.expression,
            meaning: searchParams.value.meaning,
            status: searchParams.value.status,
            t: searchParams.value.t
        }
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

// 加载用户偏好
const loadPrefs = () => {
    try {
        const saved = localStorage.getItem(PREFS_KEY);
        if (saved) {
            const prefs = JSON.parse(saved);
            if (prefs.sort?.field && prefs.sort?.order) {
                sortParams.value.field = prefs.sort.field;
                sortParams.value.order = prefs.sort.order;
            }
            if (prefs.search) {
                searchParams.value = {
                    expression: prefs.search.expression || '',
                    meaning: prefs.search.meaning || '',
                    status: prefs.search.status,
                    t: prefs.search.t
                };
            }
        }
    } catch (error) {
        console.error('Failed to load preferences:', error);
    }
};

// 切换明亮/黑暗模式
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});

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

const showWordModal = ref(false);
const word = ref({})

const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];

// 状态下拉选项
const statusOptions = computed(() => [
    { label: "All", value: undefined },
    ...statusMap.map((status, index) => ({ label: status, value: index }))
]);

// 类型下拉选项
const typeOptions = [
    { label: "All", value: undefined },
    { label: "Word", value: "WORD" },
    { label: "Phrase", value: "PHRASE" }
];

// 搜索和筛选状态
const searchParams = ref({
    expression: '',
    meaning: '',
    status: undefined as number | undefined,
    t: undefined as string | undefined
});

// 排序状态
const sortParams = ref({
    field: 'date' as 'status' | 'date',
    order: 'desc' as 'asc' | 'desc'
});

// 改变显示新增显示状态
const onChangeShow = (state: boolean) => {
    showWordModal.value = state
}

const onChangeWord = () => {
    expressions();
}

const onAddWord = () => {
    word.value = {
        expression: null,
        meaning: null,
        status: 0,
        t: "WORD",
        tags: [],
        notes: [],
        sentences: [],
    };
    showWordModal.value = true;
}

// 卡片编辑处理
const handleEditWord = async (item: Row) => {
    word.value = await plugin.storage.DB()?.getExpression(item.expr);
    showWordModal.value = true;
};

// 重置搜索和筛选
const resetFilters = () => {
    searchParams.value = {
        expression: '',
        meaning: '',
        status: undefined,
        t: undefined
    };
    sortParams.value = {
        field: 'date',
        order: 'desc'
    };
    currentPage.value = 0;
    data.value = [];
    hasMore.value = true;
    expressions();
}

// 检查是否有激活的筛选条件（优化：移除不必要的 !! 转换）
const hasActiveFilters = computed(() => {
    return Boolean(
        searchParams.value.expression ||
        searchParams.value.meaning ||
        searchParams.value.status !== undefined ||
        searchParams.value.t
    );
});

// 搜索变化处理（防抖已在 SearchFilterPanel 中处理）
const onSearchChange = () => {
    currentPage.value = 0;
    data.value = [];
    hasMore.value = true;
    savePrefs(); // 保存偏好
    expressions();
};

// 处理排序
const handleSort = async (field: 'status' | 'date') => {
    console.log('Sorting by:', field, 'current params:', sortParams.value);

    if (sortParams.value.field === field) {
        // 切换排序方向
        sortParams.value.order = sortParams.value.order === 'asc' ? 'desc' : 'asc';
    } else {
        // 新字段，默认降序
        sortParams.value.field = field;
        sortParams.value.order = 'desc';
    }

    currentPage.value = 0;
    data.value = [];
    hasMore.value = true;
    console.log('After sort:', sortParams.value);

    savePrefs(); // 保存偏好

    // 强制重新加载数据
    await expressions();
};

// 兼容文件同步后的数据库未重新打开读取数据问题
const refresh = async () => { 
    if (loading.value) {
        return;
    }

    loading.value = true

    // 重新注册数据库
    await plugin.storage.reRegister(plugin.settings.storage.storage_type);

    await expressions();
};

const expressions = async () => {
    // 如果是初始加载（currentPage为0），显示全局loading
    const isInitialLoad = currentPage.value === 0;
    if (isInitialLoad) {
        loading.value = true;
    }
    error.value = null;

    try {
        // 构建搜索参数
        const search: any = {};
        if (searchParams.value.expression) {
            search.expression = searchParams.value.expression;
        }
        if (searchParams.value.meaning) {
            search.meaning = searchParams.value.meaning;
        }
        if (searchParams.value.status !== undefined) {
            search.status = searchParams.value.status;
        }
        if (searchParams.value.t) {
            search.t = searchParams.value.t;
        }

        // 添加标签搜索（选中的标签）
        const selectedTagsArray = selectedTags.value;
        if (selectedTagsArray.length > 0) {
            search.tags = selectedTagsArray;
        }

        // 构建排序参数 - 映射字段名
        const sort: any = {};
        const fieldMapping: Record<string, string> = {
            'status': 'status',
            'date': 'date'
        };

        if (sortParams.value.field) {
            const mappedField = fieldMapping[sortParams.value.field] || sortParams.value.field;
            sort[mappedField] = sortParams.value.order;
        }

        // 传递真实的分页参数给后端
        const paginate = {
            page: currentPage.value,  // 当前页码（0-based）
            pageSize: pageSize.value  // 每页大小
        };

        let response = await plugin.storage.DB().getAllExpressionSimple(
            true,  // ignores
            sort,   // sort
            Object.keys(search).length > 0 ? search : undefined,  // search（包含标签）
            paginate  // 传递分页参数
        );

        // 处理数据
        const newData = response.data.map((entry: any): Row => {
            let date = moment(entry.date);

            return {
                expr: entry.expression,
                status: statusMap[entry.status],
                statusIndex: entry.status, // 添加状态索引用于颜色映射
                meaning: entry.meaning,
                tags: entry.tags,
                noteNum: entry.note_num,
                senNum: entry.sen_num,
                date: date.format("YYYY-MM-DD"),
            };
        });

        // 如果是初始加载，替换所有数据；否则追加新数据
        if (isInitialLoad) {
            data.value = newData;
        } else {
            data.value = [...data.value, ...newData];
        }

        // 更新 hasMore 状态
        hasMore.value = data.value.length < response.total;

        // 只在第一次加载时获取标签
        if (tags.value.length === 0) {
            tags.value = await plugin.storage.DB().getTags();
            checkedTags.value = Array(tags.value.length).map((_) => false);
        }
    } catch (err) {
        console.error("Failed to load expressions:", err);
        error.value = t("Failed to load data. Please try again.");
        data.value = [];
        new Notice(t("Failed to load data"));
    } finally {
        loading.value = false;
        loadingMore.value = false;
    }
}

// 重试加载数据
const retryLoad = () => {
    retryCount.value++;
    expressions();
};

// 导出数据
const handleExport = (format: 'csv' | 'json') => {
    const dataToExport = filteredData.value;

    if (format === 'csv') {
        exportToCSV(dataToExport);
    } else if (format === 'json') {
        exportToJSON(dataToExport);
    }
};

// 导出为 CSV
const exportToCSV = (data: Row[]) => {
    if (data.length === 0) {
        new Notice(t("No data to export"));
        return;
    }

    // CSV 头部
    const headers = ['Expression', 'Meaning', 'Tags', 'Status', 'Date', 'Notes Count', 'Sentences Count'];

    // CSV 数据
    const csvData = data.map(row => [
        `"${row.expr}"`,
        `"${(row.meaning || '').replace(/"/g, '""')}"`,
        `"${row.tags.join(', ')}"`,
        `"${row.status}"`,
        `"${row.date}"`,
        row.noteNum,
        row.senNum
    ]);

    // 组合 CSV
    const csv = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
    ].join('\n');

    // 创建 Blob 并下载
    downloadFile(csv, 'word-data.csv', 'text/csv;charset=utf-8;');
    new Notice(`${t("Words exported successfully")}: ${data.length} ${t("words").toLowerCase()}`);
};

// 导出为 JSON
const exportToJSON = (data: Row[]) => {
    if (data.length === 0) {
        new Notice(t("No data to export"));
        return;
    }

    const jsonData = data.map(row => ({
        expression: row.expr,
        meaning: row.meaning,
        tags: row.tags,
        status: row.status,
        statusIndex: row.statusIndex,
        date: row.date,
        notesCount: row.noteNum,
        sentencesCount: row.senNum
    }));

    const json = JSON.stringify(jsonData, null, 2);
    downloadFile(json, 'word-data.json', 'application/json;charset=utf-8;');
    new Notice(`${t("Words exported successfully")}: ${data.length} ${t("words").toLowerCase()}`);
};

// 下载文件辅助函数
const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

onMounted(() => {
    loadPrefs(); // 加载用户偏好
    expressions();
    setupInfiniteScroll();
});

onBeforeUnmount(() => {
    cleanupInfiniteScroll();
});

let data = ref<Row[]>([]);

let mode = ref("and");
let tags = ref<string[]>([]);
let checkedTags = ref<boolean[]>([]);

// 根据标签筛选数据（优化：缓存选中的标签数组）
const selectedTags = computed(() => {
    return tags.value.filter((tag, i) => checkedTags.value[i]);
});

// 根据标签筛选数据（现在用于显示筛选结果提示）
const filteredData = computed(() => {
    return data.value; // 标签筛选已移到后端，前端直接显示所有数据
});

// 监听标签变化，重新加载数据（从后端获取）
watch([selectedTags, mode], () => {
    console.log('Tags filter changed:', selectedTags.value, 'Mode:', mode.value);
    // 标签筛选改变时重置并重新加载
    currentPage.value = 0;
    data.value = [];
    hasMore.value = true;
    expressions();
}, { deep: true });

// 防抖函数
const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

// 检查是否滚动到底部
const checkScrollBottom = () => {
    if (!scrollContainer.value) return;

    const container = scrollContainer.value;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // 当滚动到距离底部 200px 时触发加载
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom < 200 && !loadingMore.value && !loading.value && hasMore.value) {
        loadMore();
    }
};

// 防抖版本的滚动检查
const debouncedCheckScroll = debounce(checkScrollBottom, 100);

// 加载更多数据（调用后端获取下一页）
const loadMore = async () => {
    if (loadingMore.value || loading.value || !hasMore.value) return;

    loadingMore.value = true;
    currentPage.value++;

    try {
        await expressions();
    } catch (err) {
        console.error("Failed to load more:", err);
        currentPage.value--; // 回退页码
    }
};

// 设置无限滚动
const setupInfiniteScroll = () => {
    if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', debouncedCheckScroll);
    }
};

// 清理无限滚动
const cleanupInfiniteScroll = () => {
    if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', debouncedCheckScroll);
    }
};

// 监听 scrollContainer 变化，重新设置滚动监听
watch(scrollContainer, (newContainer) => {
    if (newContainer) {
        setupInfiniteScroll();
    }
});
</script>

<style lang="scss">
#langr-data {
    padding: 10px;

    .search-section,
    .tag-section {
        margin-bottom: 16px;
    }

    // 内容容器
    .content-container {
        min-height: 400px;
        max-height: calc(100vh - 350px);
        overflow-y: auto;
    }

    // 滚动容器
    .scroll-container {
        position: relative;
    }

    // 自定义空状态样式
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        text-align: center;

        .empty-icon {
            font-size: 64px;
            line-height: 1;
            margin-bottom: 24px;
            display: block;
        }

        .empty-description {
            font-size: 16px;
            line-height: 1.6;
            color: var(--n-text-color-2);
            margin-bottom: 32px;
            max-width: 500px;
        }

        .empty-actions {
            display: flex;
            justify-content: center;
            gap: 12px;
        }
    }

    .card-list-section {
        margin-top: 16px;

        .filter-info {
            padding: 8px 12px;
            background: var(--n-color-modal);
            border-radius: 4px;
            margin-bottom: 12px;
            text-align: center;
            font-size: 0.9em;
            color: var(--n-text-color-2);
        }
    }

    // 加载更多部分
    .load-more-section {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        margin-top: 16px;

        .load-more-text {
            font-size: 14px;
            color: var(--n-text-color-2);
            text-align: center;
        }
    }

    // 没有更多数据
    .no-more-section {
        display: flex;
        justify-content: center;
        padding: 20px;
        margin-top: 16px;
        font-size: 14px;
        color: var(--n-text-color-3);
    }
}
</style>
