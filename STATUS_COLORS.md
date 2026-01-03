# 单词学习状态颜色配置

## 概述

本项目使用统一的颜色配置系统来管理单词学习状态的显示颜色，确保在 `ReadingArea` 和 `DataPanel` 中颜色显示的一致性。

## 状态定义

| 状态码 | 状态名称 | 颜色 | 说明 |
|--------|----------|------|------|
| 0 | Ignore | 灰色 #d1d5db | 忽略的单词 |
| 1 | Learning | 橙色 #f59e0b | 正在学习中的单词 |
| 2 | Familiar | 蓝色 #3b82f6 | 熟悉的单词 |
| 3 | Known | 绿色 #22c55e | 已知的单词 |
| 4 | Learned | 深绿色 #10b981 | 已掌握的单词 |

## 颜色配置文件

### 1. TypeScript 配置文件
**位置**: `src/statusColors.ts`

提供以下功能：
- `WordStatus` 枚举：定义所有学习状态
- `StatusColors` 对象：包含每个状态的完整颜色配置（主色、背景色、边框色）
- `StatusColorMap` 映射：通过状态索引获取颜色配置
- `StatusClassMap` 映射：通过状态索引获取 CSS 类名
- 辅助函数：`getStatusColor()`, `getStatusClass()`, `getStatusMainColor()` 等

**使用示例**：
```typescript
import { getStatusColor, getStatusMainColor } from '@/statusColors';

// 获取完整颜色配置
const colorConfig = getStatusColor(statusIndex);

// 获取主色（用于标签文字颜色）
const mainColor = getStatusMainColor(statusIndex);
```

### 2. CSS 变量文件
**位置**: `src/statusColors.css`

定义了 CSS 变量，可以在任何 SCSS 文件中使用：

```scss
// 使用 CSS 变量
.my-element {
    background-color: var(--status-learning-bg);
    color: var(--status-learning-main);
    border: 1px solid var(--status-learning-border);
}
```

可用的 CSS 变量：
- `--status-ignore-main/bg/border`
- `--status-learning-main/bg/border`
- `--status-familiar-main/bg/border`
- `--status-known-main/bg/border`
- `--status-learned-main/bg/border`

## 在组件中使用

### ReadingArea.vue

使用 CSS 类名应用颜色：
```scss
span {
    .learning {
        background-color: var(--status-learning-bg);
    }
    .known {
        background-color: var(--status-known-bg);
    }
}
```

### DataPanel.vue

在渲染函数中使用 TypeScript 配置：
```typescript
import { StatusColorMap } from '@/statusColors';

render(row) {
    const colorConfig = StatusColorMap[row.statusIndex];
    return h(NTag, {
        style: {
            backgroundColor: colorConfig.bg,
            color: colorConfig.main,
            border: `1px solid ${colorConfig.border}`
        }
    }, { default: () => row.status });
}
```

## 颜色透明度说明

- **Main Color**: 100% 不透明，用于文字颜色、图标等
- **Background**: ~27-33% 透明度，用于背景高亮
- **Border**: 40% 透明度，用于边框

## 主题适配

CSS 变量文件包含主题适配的预留位置：
```css
.theme-dark {
    /* 暗色主题特殊处理 */
}

.theme-light {
    /* 亮色主题特殊处理 */
}
```

如需为不同主题定制颜色，可以在这些规则中覆盖 CSS 变量。

## 扩展指南

如果需要添加新的学习状态：

1. 在 `statusColors.ts` 中添加新的枚举值和颜色配置
2. 在 `statusColors.css` 中添加对应的 CSS 变量
3. 更新相关组件以支持新状态

## 维护注意事项

- 修改颜色时，请同时更新 TypeScript 配置和 CSS 变量
- 确保颜色对比度符合可访问性标准
- 测试在亮色和暗色主题下的显示效果
- 保持颜色系统的一致性，避免使用过多不同的颜色变体
