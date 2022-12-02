<template>
    <div class="count-bar" @click="changeUnit">
        <div class="b1" :style="styleA">
            {{ percent(props.unknown) }}
        </div>
        <div class="b2" :style="styleB">
            {{ percent(props.learn) }}
            <!-- {{props.learn}} -->
        </div>
        <div class="b3" :style="styleC">
            {{ percent(props.ignore) }}
            <!-- {{props.ignore}} -->
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
const props = defineProps({
    unknown: Number,
    learn: Number,
    ignore: Number,
});

let isPercent = ref(true);

function percent(num: number) {
    if (!isPercent.value) {
        return num;
    }
    let total = props.unknown + props.learn + props.ignore;
    let res = num / total;
    return ((Math.round(res * 1000) * 100) / 1000).toString() + "%";
}

function changeUnit() {
    isPercent.value = !isPercent.value;
}
// let a = ref(10)p
// let b = ref(10)
// let c = ref(50)
let styleA = computed(() => {
    return { flex: props.unknown };
});
let styleB = computed(() => {
    return { flex: props.learn };
});
let styleC = computed(() => {
    return { flex: props.ignore };
});
</script>

<style lang="scss">
/*计数条*/
.count-bar {
    border: 2px solid black;
    height: 20px;
    width: 80%;
    display: flex;
    /* font-size: 0.3em; */
    text-align: center;
    color: black;
    /* font-weight: bold; */
    cursor: pointer;
    line-height: 1em;
    border-radius: 10px;
    .b1 {
        background-color: rgba(173, 216, 230, 0.734);
        border-top-left-radius: 10px;
        border-bottom-left-radius: 10px;
    }
    .b2 {
        background-color: rgba(255, 166, 0, 0.705);
    }
    .b3 {
        background-color: rgba(211, 211, 211, 0.747);
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
    }
}
</style>
