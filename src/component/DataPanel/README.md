# DataPanel 组件重构说明

## 概述

对 DataPanel.vue 进行了组件拆分和移动端展示优化，提高了代码的可维护性和移动端用户体验。

## 目录结构

```
src/component/DataPanel/
├── ActionButtons.vue          # 操作按钮组件
├── SearchFilterPanel.vue      # 搜索和筛选面板组件
├── TagFilter.vue              # 标签筛选组件
└── README.md                  # 本文档
```

## 组件说明

### 1. ActionButtons.vue
**功能**: 显示操作按钮（添加单词、刷新数据库、重置筛选）

**Props**:
- `hasActiveFilters`: boolean - 是否有激活的筛选条件
- `isMobile`: boolean - 是否为移动端

**Events**:
- `@addWord` - 点击添加单词按钮
- `@refresh` - 点击刷新按钮
- `@resetFilters` - 点击重置筛选按钮

**移动端优化**:
- 按钮在移动端垂直排列，居中对齐
- 使用 `tiny` 尺寸替代 `small`

### 2. SearchFilterPanel.vue
**功能**: 提供单词、含义的搜索和状态、类型的筛选

**Props**:
- `modelValue`: 搜索参数对象
  - `expression`: string - 单词搜索
  - `meaning`: string - 含义搜索
  - `status`: number | undefined - 状态筛选
  - `t`: string | undefined - 类型筛选
- `statusOptions`: 状态选项数组
- `typeOptions`: 类型选项数组
- `isMobile`: boolean - 是否为移动端

**Events**:
- `@update:modelValue` - 更新搜索参数
- `@search` - 触发搜索（带防抖）

**移动端优化**:
- 标签和输入框使用更小的字体
- Grid 布局在移动端调整为 2 列
- 输入框使用 `tiny` 尺寸

### 3. TagFilter.vue
**功能**: 显示和管理标签筛选

**Props**:
- `tags`: string[] - 标签列表
- `checkedTags`: boolean[] - 标签选中状态
- `mode`: 'and' | 'or' - 筛选模式
- `isMobile`: boolean - 是否为移动端

**Events**:
- `@update:checkedTags` - 更新标签选中状态
- `@update:mode` - 更新筛选模式

**移动端优化**:
- 支持垂直布局
- 标签使用 `tiny` 尺寸
- 减小间距以适应小屏幕

## 主组件变化 (DataPanel.vue)

### 新增功能

1. **移动端检测**
```typescript
const isMobile = computed(() => Platform.isMobileApp);
```

2. **响应式表格列**
- 移动端只显示: Word、Status、Action
- 桌面端显示: Expr、Meaning、Tags、Status、Date、Action

3. **主题配置优化**
```typescript
const themeConfig: GlobalThemeOverrides = {
    DataTable: {
        fontSizeSmall: isMobile.value ? "10px" : "14px",
        tdPaddingSmall: isMobile.value ? "6px" : "8px",
        thPaddingSmall: isMobile.value ? "8px" : "12px",
    },
};
```

### 移动端优化特性

1. **布局调整**
   - 减小 padding 和间距
   - 按钮垂直排列
   - 表格横向滚动优化

2. **字体和尺寸**
   - 表格字体: 10px (移动端) / 14px (桌面端)
   - 按钮: tiny (移动端) / small (桌面端)
   - 标签: tiny (移动端) / small (桌面端)

3. **交互优化**
   - 所有可点击元素增大点击区域
   - 简化移动端显示信息
   - 优化分页控件

## 使用方法

直接使用主组件即可，子组件会自动处理移动端适配：

```vue
<DataPanel />
```

## 样式覆盖

如需自定义样式，可以针对以下选择器：

```scss
// 移动端专用样式
#langr-data.mobile {
    // 自定义移动端样式
}

// 桌面端样式
#langr-data {
    // 自定义桌面端样式
}
```

## 注意事项

1. 所有子组件都支持响应式设计，会根据 `isMobile` prop 自动调整
2. 搜索功能内置了 500ms 防抖
3. 表格在移动端会自动简化显示，详细信息通过展开查看
4. 分页组件会自动适配移动端

## 未来改进建议

1. 添加虚拟滚动以支持大数据集
2. 考虑添加移动端手势支持
3. 优化移动端的表格展开交互
4. 添加更多的移动端专用功能（如批量编辑）
