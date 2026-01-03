/**
 * 单词学习状态颜色配置
 * 统一管理 ReadingArea 和 DataPanel 的状态颜色
 */

export enum WordStatus {
    Ignore = 0,    // 忽略
    Learning = 1,  // 学习中
    Familiar = 2,  // 熟悉
    Known = 3,     // 已知
    Learned = 4,   // 已掌握
}

/**
 * 状态颜色配置
 * 包含主色和透明度变体
 */
export const StatusColors = {
    [WordStatus.Ignore]: {
        main: '#d1d5db',      // 灰色
        bg: 'rgba(209, 213, 219, 0.27)',      // #d1d5db with ~27% opacity
        border: 'rgba(209, 213, 219, 0.4)',   // #d1d5db with 40% opacity
        class: 'ignore'
    },
    [WordStatus.Learning]: {
        main: '#f59e0b',      // 橙色
        bg: 'rgba(245, 158, 11, 0.33)',       // #f59e0b with ~33% opacity
        border: 'rgba(245, 158, 11, 0.4)',    // #f59e0b with 40% opacity
        class: 'learning'
    },
    [WordStatus.Familiar]: {
        main: '#3b82f6',      // 蓝色
        bg: 'rgba(59, 130, 246, 0.33)',       // #3b82f6 with ~33% opacity
        border: 'rgba(59, 130, 246, 0.4)',    // #3b82f6 with 40% opacity
        class: 'familiar'
    },
    [WordStatus.Known]: {
        main: '#22c55e',      // 绿色
        bg: 'rgba(34, 197, 94, 0.33)',        // #22c55e with ~33% opacity
        border: 'rgba(34, 197, 94, 0.4)',     // #22c55e with 40% opacity
        class: 'known'
    },
    [WordStatus.Learned]: {
        main: '#10b981',      // 深绿色
        bg: 'rgba(16, 185, 129, 0.33)',       // #10b981 with ~33% opacity
        border: 'rgba(16, 185, 129, 0.4)',    // #10b981 with 40% opacity
        class: 'learned'
    },
} as const;

/**
 * 状态索引到颜色对象的映射（用于 DataPanel）
 */
export const StatusColorMap: Record<number, typeof StatusColors[WordStatus]> = {
    0: StatusColors[WordStatus.Ignore],
    1: StatusColors[WordStatus.Learning],
    2: StatusColors[WordStatus.Familiar],
    3: StatusColors[WordStatus.Known],
    4: StatusColors[WordStatus.Learned],
};

/**
 * 状态索引到 CSS 类名的映射（用于 ReadingArea）
 */
export const StatusClassMap: Record<number, string> = {
    0: 'ignore',
    1: 'learning',
    2: 'familiar',
    3: 'known',
    4: 'learned',
};

/**
 * 获取状态的颜色配置
 */
export function getStatusColor(status: number): typeof StatusColors[WordStatus] {
    return StatusColorMap[status] || StatusColors[WordStatus.Ignore];
}

/**
 * 获取状态的 CSS 类名
 */
export function getStatusClass(status: number): string {
    return StatusClassMap[status] || 'ignore';
}

/**
 * 获取状态的主色（用于标签等）
 */
export function getStatusMainColor(status: number): string {
    return getStatusColor(status).main;
}

/**
 * 获取状态的背景色（用于高亮显示）
 */
export function getStatusBgColor(status: number): string {
    return getStatusColor(status).bg;
}

/**
 * 获取状态的边框色（用于标签边框）
 */
export function getStatusBorderColor(status: number): string {
    return getStatusColor(status).border;
}
