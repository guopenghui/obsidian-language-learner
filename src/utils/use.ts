import { onMounted, onUnmounted, unref } from "vue";
import type { Ref } from "vue";
import type { EventMap } from "@/constant";

function useEvent<T extends keyof EventMap>(
    elRef: Ref<EventTarget> | EventTarget,
    type: T,
    listener: (ev: EventMap[T]) => void
) {
    onMounted(() => {
        unref(elRef).addEventListener(type, listener);
    });
    onUnmounted(() => {
        unref(elRef).removeEventListener(type, listener);
    });
}

export { useEvent };