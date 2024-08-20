<script setup lang="ts">
import { useData } from "vitepress"
import { reactive, watch, toRefs, ref, onMounted } from "vue"
import { CalendarHeatmap } from 'vue3-calendar-heatmap'

const { isDark } = useData();
const data = reactive({
    darkMode: isDark,
    endDate: Date.now(),
})
const { darkMode, endDate } = toRefs(data);

const heatMapData = ref<any[]>([]);
const colorRange = ref<any[]>([]);
if (isDark.value) {
    colorRange.value = ["#1f1f22", "#1f1f22", "#0e4429", "#006d32", "#26a641", "#39d353"]
} else {
    colorRange.value = ["#ebedf0", "#ebedf0","#9be9a8", "#40c463", "#30a14e", "#216e39"]
}

const fetchData = async () => {
    const response = await fetch('https://github-calendar-api.shinya.click/api?senshinya'); // 替换为你的 API 地址
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    heatMapData.value = await response.json();
};

onMounted(() => {
    fetchData();
});

watch(
    isDark,
    () => {
        if (isDark.value) {
            darkMode.value = true
            colorRange.value = ["#1f1f22", "#1f1f22", "#0e4429", "#006d32", "#26a641", "#39d353"]
        } else {
            darkMode.value = false
            colorRange.value = ["#ebedf0", "#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]
        }
    }
)
</script>

<template>
    <div class="heatmap-wrapper">
        <CalendarHeatmap :round="1.5" :values="heatMapData" :end-date="endDate" :dark-mode="darkMode" :range-color="colorRange"/>
        <div id="heatmap-legend">
            <div>Github Contributions from <a href="https://github.com/senshinya" target="_blank">shinya</a></div>
        </div>
    </div>
</template>

<style lang="scss">
#heatmap-legend {
    margin-top: 10px;
    color: #767676;
    font-size: 14px;
    a {
        text-decoration: none;
        color: #767676;
    }
}

.heatmap-wrapper {
    margin-top: 40px;
    max-width: 100%;
}

.vch__legend {
    display: none !important;
}

@media screen and (max-width: 768px) {
    .heatmap-wrapper {
        display: none;
    }
}

.vch__container {
    .vch__legend {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .vch__external-legend-wrapper {
        margin: 0 8px;
    }
}

svg.vch__wrapper {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 8px;
    width: 100%;

    .vch__months__labels__wrapper text.vch__month__label {
        font-size: 8px;
    }

    .vch__days__labels__wrapper text.vch__day__label,
    .vch__legend__wrapper text {
        font-size: 9px;
    }

    text.vch__month__label,
    text.vch__day__label,
    .vch__legend__wrapper text {
        fill: #767676;
    }

    rect.vch__day__square:hover {
        stroke: #555;
        stroke-width: 2px;
        paint-order: stroke;
    }

    rect.vch__day__square:focus {
        outline: none;
    }

    &.dark-mode {
        text.vch__month__label,
        text.vch__day__label,
        .vch__legend__wrapper text {
            fill: #fff;
        }
    }
}

.tippy-box {
    background-color: var(--vp-c-neutral);
    font-size: 0.8rem;
    color: var(--vp-c-neutral-inverse);
    padding: 0.4rem;
    border-radius: 5px;
}
</style>