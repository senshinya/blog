<script setup lang="ts">
import { useData } from "vitepress"
import { reactive, watch, toRefs, ref, onMounted } from "vue"
import 'vue3-calendar-heatmap/dist/style.css'

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
    const response = await fetch('https://wakatime-calendar-api.shinya.click/api');
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
        <calendar-heatmap :round="1.5" tooltip-unit="hours" :values="heatMapData" :end-date="endDate" :dark-mode="darkMode" :range-color="colorRange"/>
        <div id="heatmap-legend">
            <div>每日 Coding 时间 from WakaTime</div>
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
    margin-top: 0px;
    margin-bottom: 50px;
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
</style>