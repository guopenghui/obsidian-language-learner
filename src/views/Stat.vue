<template>
    <!-- <h2>This is A Test Page</h2>
    <input type="text" v-model="text"/>
    <button @click="log">log</button>
    <div>{{syntaxTree}}</div> -->
    <div id="chart"></div>
</template>

<script setup lang="ts">
import {moment} from "obsidian"
import { computed, ref, onMounted, onUnmounted, getCurrentInstance } from "vue"
import {count_seven} from "../api"
import {t} from "../lang/helper"
import {unified} from "unified"
import retextEnglish from 'retext-english'

import * as echarts from "echarts/core"

import { 
  GridComponent, 
  GridComponentOption,
  TooltipComponent,
  TooltipComponentOption,
  TitleComponent,
  TitleComponentOption,
} from 'echarts/components';
import { LineChart, LineSeriesOption } from 'echarts/charts';
import { UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { words } from "lodash";

echarts.use([
  GridComponent, 
  LineChart, 
  TooltipComponent,
  TitleComponent,
  CanvasRenderer, 
  UniversalTransition,
]);

type EChartsOption = echarts.ComposeOption<
  GridComponentOption | LineSeriesOption | TooltipComponentOption | TitleComponentOption
>;

const container = getCurrentInstance().appContext.config.globalProperties.container

let charDom: HTMLElement
let sevenDays: echarts.EChartsType
let option: EChartsOption;

onMounted(async () => {
    charDom = container.querySelector("#chart")
    // setTimeout(() => {
      sevenDays = echarts.init(charDom, null, {
        width: 400,
        height: 350
      })
      option && sevenDays.setOption(option)
    // },0)
    updateChart()
})

const last7days = [6,5,4,3,2,1,0].map((i) => moment().subtract(i,"days").format("M-D"))

option = {
  title: {
    text: "Words",
  },
  tooltip: {
    trigger: 'axis'
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: last7days
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: t("Single day"),
      data: [],
      type: 'line',
      areaStyle: {},
      smooth: true,
      encode: {
        tooltip: ["words"]
      },
      emphasis: {
        focus: 'series'
      },
    },
    {
      name: t("Accumulated"),
      data: [],
      type: 'line',
      emphasis: {
        focus: 'series'
      },
    }
  ]
}

async function updateChart() {
  let data = await count_seven();
  let dayWords = data.map((d) => d.today);
  let accumWords = data.map((d) => d.accumulated)
  
  sevenDays.setOption({
    series: [
      {data: dayWords},
      {data: accumWords}
    ]
  })  
}

onMounted(() => {
  addEventListener("obsidian-langr-refresh-stat", updateChart);
})

onUnmounted(() => {
  removeEventListener("obsidian-langr-refresh-stat", updateChart);
})

// const processor = unified().use(retextEnglish)

// let text = ref("")
// let syntaxTree = computed(() => {
//     return processor.parse(text.value)
// })
// function log() {
//     console.log(syntaxTree);
// }
</script>