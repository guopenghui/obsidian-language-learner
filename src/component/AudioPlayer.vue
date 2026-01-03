<template>
    <div v-if="isValidAudioSource" class="audio-player-container">
        <audio
            ref="audioRef"
            controls
            :src="currentSrc"
            @loadstart="onLoadStart"
            @canplay="onCanPlay"
            @canplaythrough="onCanPlayThrough"
            @loadeddata="onLoadedData"
            @loadedmetadata="onLoadedMetadata"
            @error="onError"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
            @stalled="onStalled"
            @suspend="onSuspend"
            @waiting="onWaiting"
            @progress="onProgress"
        />

        <!-- 加载状态指示器 -->
        <div v-if="loadingState.show" class="audio-status-indicator" :class="loadingState.type">
            <div class="status-content">
                <div v-if="loadingState.type === 'loading'" class="loading-spinner"></div>
                <span class="status-text">{{ loadingState.message }}</span>
                <span v-if="loadingState.progress > 0 && loadingState.progress < 100" class="progress-text">
                    ({{ Math.round(loadingState.progress) }}%)
                </span>
            </div>
            <div v-if="loadingState.type === 'error' && retryCount < maxRetries" class="retry-button" @click="retryLoad">
                {{ t("Retry") }}
            </div>
        </div>

        <!-- 音频信息显示 -->
        <div v-if="!loadingState.show && audioMetadata.duration > 0" class="audio-info">
            <span class="audio-duration">{{ formatTime(audioMetadata.duration) }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Platform } from "obsidian";
import { t } from "@/lang/helper";

const props = defineProps<{
    audioSource: string;
    maxRetries?: number; // 最大重试次数
    retryDelay?: number; // 重试延迟(毫秒)
}>();

const emit = defineEmits<{
    (e: "loaded"): void;
    (e: "error", error: { message: string; code?: number; retryable: boolean }): void;
    (e: "play"): void;
    (e: "pause"): void;
    (e: "ended"): void;
    (e: "retry", count: number): void;
}>();

// 默认值
const maxRetries = computed(() => props.maxRetries ?? 3);
const retryDelay = computed(() => props.retryDelay ?? 2000);

// 音频元素引用
const audioRef = ref<HTMLAudioElement>();

// 加载状态管理
const loadingState = ref({
    show: false,
    type: "loading" as "loading" | "error" | "warning",
    message: "",
    progress: 0,
});

// 重试计数器
const retryCount = ref(0);
const isRetrying = ref(false);

// 音频元数据
const audioMetadata = ref({
    duration: 0,
    currentTime: 0,
});

// 当前使用的音频源
const currentSrc = ref("");

// 加载超时定时器
const loadTimeoutTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// 获取本地文件前缀
const getLocalPrefix = (): string => {
    try {
        if (Platform.isDesktopApp) {
            return require("electron").ipcRenderer.sendSync("file-url");
        }
        return "http://localhost/_capacitor_file_";
    } catch (e) {
        console.warn("Failed to get local prefix:", e);
        return "";
    }
};

// 处理音频源路径，兼容移动端和桌面端
const processedAudioSource = computed(() => {
    if (!props.audioSource) {
        return "";
    }

    const source = props.audioSource.trim();

    // 如果是 HTTP(S) URL，直接返回
    if (source.startsWith("http://") || source.startsWith("https://")) {
        return source;
    }

    // 处理 ~/ 开头的相对路径（Obsidian 附件文件夹路径）
    // if (source.startsWith("~/")) {
    //     const prefix = Platform.isDesktopApp ? getLocalPrefix() : "http://localhost/_capacitor_file_";
    //     const basePath = props.basePath || "";
    //     return prefix + basePath + source.slice(1);
    // }

    // 处理其他相对路径
    if (Platform.isDesktopApp) {
        return getLocalPrefix() + source;
    } else {
        // 移动端处理相对路径
        return source.startsWith("/") ? `http://localhost/_capacitor_file_${source}` : source;
    }
});

// 验证音频源是否有效
const isValidAudioSource = computed(() => {
    return Boolean(props.audioSource && props.audioSource.trim().length > 0);
});

// 更新加载状态
const updateLoadingState = (
    show: boolean,
    type: "loading" | "error" | "warning",
    message: string,
    progress: number = 0
) => {
    loadingState.value = { show, type, message, progress };
};

// 音频事件处理
const onLoadStart = () => {
    updateLoadingState(true, "loading", t("Loading audio..."));
    console.log("[AudioPlayer] Load started");
};

const onLoadedMetadata = () => {
    if (audioRef.value) {
        audioMetadata.value.duration = audioRef.value.duration;
        console.log("[AudioPlayer] Metadata loaded, duration:", audioMetadata.value.duration);
    }
};

const onLoadedData = () => {
    console.log("[AudioPlayer] Data loaded");
};

const onProgress = () => {
    if (audioRef.value && audioRef.value.buffered.length > 0) {
        const bufferedEnd = audioRef.value.buffered.end(audioRef.value.buffered.length - 1);
        const progress = (bufferedEnd / audioRef.value.duration) * 100;
        updateLoadingState(
            true,
            "loading",
            t("Loading audio..."),
            progress
        );
    }
};

const onCanPlay = () => {
    console.log("[AudioPlayer] Can play");
    clearLoadTimeout();
    updateLoadingState(false, "loading", "");
    retryCount.value = 0; // 重置重试计数
    emit("loaded");
};

const onCanPlayThrough = () => {
    console.log("[AudioPlayer] Can play through");
    clearLoadTimeout();
    updateLoadingState(false, "loading", "");
};

const onWaiting = () => {
    console.log("[AudioPlayer] Waiting for data");
    updateLoadingState(true, "loading", t("Buffering..."));
};

const onStalled = () => {
    console.warn("[AudioPlayer] Loading stalled");
    updateLoadingState(true, "warning", t("Connection stalled, waiting..."));
};

const onSuspend = () => {
    console.log("[AudioPlayer] Loading suspended");
};

const onError = (e: Event) => {
    const target = e.target as HTMLAudioElement;
    const errorCode = target.error?.code;
    const errorMessage = target.error?.message || getErrorMessage(errorCode);

    console.error("[AudioPlayer] Error:", errorCode, errorMessage);

    clearLoadTimeout();

    // 判断是否可以重试
    const retryable = isRetryableError(errorCode);

    if (retryable && retryCount.value < maxRetries.value) {
        updateLoadingState(
            true,
            "warning",
            t("Loading failed, retrying... ({0}/{1})", retryCount.value + 1, maxRetries.value)
        );
        scheduleRetry();
    } else {
        updateLoadingState(
            true,
            "error",
            t("Failed to load audio: {0}", errorMessage)
        );
        emit("error", {
            message: errorMessage,
            code: errorCode,
            retryable: retryable && retryCount.value < maxRetries.value,
        });
    }
};

const onPlay = () => {
    emit("play");
};

const onPause = () => {
    emit("pause");
};

const onEnded = () => {
    emit("ended");
};

// 获取错误信息
const getErrorMessage = (code?: number): string => {
    switch (code) {
        case MediaError.MEDIA_ERR_ABORTED:
            return "Audio loading aborted";
        case MediaError.MEDIA_ERR_NETWORK:
            return "Network error";
        case MediaError.MEDIA_ERR_DECODE:
            return "Audio decode error";
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            return "Audio format not supported";
        default:
            return "Unknown error";
    }
};

// 判断是否可重试的错误
const isRetryableError = (code?: number): boolean => {
    if (!code) return true;
    return [
        MediaError.MEDIA_ERR_NETWORK,
        undefined, // 某些情况下没有错误码但仍可重试
    ].includes(code);
};

// 设置加载超时
const setLoadTimeout = () => {
    clearLoadTimeout();
    loadTimeoutTimer.value = setTimeout(() => {
        if (loadingState.value.show && loadingState.value.type === "loading") {
            console.warn("[AudioPlayer] Load timeout");
            if (retryCount.value < maxRetries.value) {
                scheduleRetry();
            } else {
                updateLoadingState(
                    true,
                    "error",
                    t("Loading timeout after {0} attempts", maxRetries.value)
                );
                emit("error", {
                    message: "Load timeout",
                    retryable: false,
                });
            }
        }
    }, 30000); // 30秒超时
};

// 清除加载超时
const clearLoadTimeout = () => {
    if (loadTimeoutTimer.value) {
        clearTimeout(loadTimeoutTimer.value);
        loadTimeoutTimer.value = null;
    }
};

// 计划重试
const scheduleRetry = () => {
    if (isRetrying.value) return;

    isRetrying.value = true;
    const delay = retryDelay.value * (retryCount.value + 1); // 指数退避

    console.log(`[AudioPlayer] Scheduling retry ${retryCount.value + 1}/${maxRetries.value} in ${delay}ms`);

    setTimeout(() => {
        retryLoad();
    }, delay);
};

// 重试加载
const retryLoad = () => {
    if (retryCount.value >= maxRetries.value) {
        console.warn("[AudioPlayer] Max retries reached");
        return;
    }

    retryCount.value++;
    isRetrying.value = false;

    console.log(`[AudioPlayer] Retry attempt ${retryCount.value}/${maxRetries.value}`);
    emit("retry", retryCount.value);

    // 重新加载音频
    updateLoadingState(
        true,
        "loading",
        t("Retrying... ({0}/{1})", retryCount.value, maxRetries.value)
    );

    nextTick(() => {
        if (audioRef.value) {
            const src = currentSrc.value;
            currentSrc.value = "";
            nextTick(() => {
                currentSrc.value = src;
                setLoadTimeout();
            });
        }
    });
};

// 格式化时间
const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// 监听音频源变化
watch(
    () => processedAudioSource.value,
    (newSrc) => {
        if (newSrc && newSrc !== currentSrc.value) {
            console.log("[AudioPlayer] Audio source changed");
            currentSrc.value = newSrc;
            retryCount.value = 0; // 重置重试计数
            clearLoadTimeout();
            setLoadTimeout();
        }
    },
    { immediate: true }
);

// 暴露音频控制方法
const play = () => {
    audioRef.value?.play().catch((err) => {
        console.error("[AudioPlayer] Play error:", err);
    });
};

const pause = () => {
    audioRef.value?.pause();
};

const stop = () => {
    if (audioRef.value) {
        audioRef.value.pause();
        audioRef.value.currentTime = 0;
    }
};

const setCurrentTime = (time: number) => {
    if (audioRef.value) {
        audioRef.value.currentTime = time;
    }
};

const getCurrentTime = (): number => {
    return audioRef.value?.currentTime || 0;
};

const getDuration = (): number => {
    return audioRef.value?.duration || 0;
};

const reload = () => {
    retryCount.value = 0;
    retryLoad();
};

defineExpose({
    play,
    pause,
    stop,
    setCurrentTime,
    getCurrentTime,
    getDuration,
    reload,
});

// 组件挂载
onMounted(() => {
    console.log("[AudioPlayer] Component mounted");
    if (processedAudioSource.value) {
        setLoadTimeout();
    }
});

// 组件卸载时清理资源
onUnmounted(() => {
    console.log("[AudioPlayer] Component unmounting");
    clearLoadTimeout();
    if (audioRef.value) {
        audioRef.value.pause();
        audioRef.value.src = "";
    }
});
</script>

<style lang="scss">
.audio-player-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 8px 0;

    audio {
        width: 100%;
        height: 40px;
        outline: none;
        border-radius: 4px;

        &::-webkit-media-controls-panel {
            background-color: var(--background-modifier-border);
        }

        &::-webkit-media-controls-current-time-display,
        &::-webkit-media-controls-time-remaining-display {
            color: var(--text-normal);
        }
    }
}

// 状态指示器
.audio-status-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    margin-top: 4px;
    border-radius: 4px;
    font-size: 0.9em;
    animation: fadeIn 0.3s ease-in;

    &.loading {
        background-color: var(--background-modifier-hover);
        color: var(--text-muted);
    }

    &.warning {
        background-color: rgba(255, 152, 0, 0.1);
        color: var(--text-accent);
        border: 1px solid var(--text-accent);
    }

    &.error {
        background-color: rgba(244, 67, 54, 0.1);
        color: var(--text-error);
        border: 1px solid var(--text-error);
    }

    .status-content {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;

        .status-text {
            flex: 1;
        }

        .progress-text {
            font-size: 0.85em;
            opacity: 0.8;
        }
    }

    .retry-button {
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        font-weight: 500;
        transition: background-color 0.2s;

        &:hover {
            background-color: var(--interactive-accent-hover);
        }

        &:active {
            transform: scale(0.98);
        }
    }
}

// 加载动画
.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--text-muted);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

// 音频信息
.audio-info {
    display: flex;
    justify-content: center;
    padding: 4px 0;
    margin-top: 4px;

    .audio-duration {
        font-size: 0.85em;
        color: var(--text-muted);
        font-family: monospace;
    }
}

// 移动端适配
.is-mobile .audio-player-container {
    audio {
        height: 48px; // 移动端增大触控区域

        &::-webkit-media-controls-panel {
            padding: 4px;
        }
    }

    .audio-status-indicator {
        padding: 10px 14px;
        font-size: 0.95em;

        .retry-button {
            padding: 6px 16px;
            font-size: 1em;
        }
    }

    .loading-spinner {
        width: 18px;
        height: 18px;
    }
}
</style>
