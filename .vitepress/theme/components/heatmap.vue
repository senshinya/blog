<template>
    <div class="heatmap-container">
        <div class="heatmap-title">
                Github Contributions from <a href="https://github.com/senshinya" target="_blank">信也</a>
        </div>
        <div class="heatmap-container-img">
            <img v-bind:src="heatmap_url" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useData } from "vitepress"
import { reactive, watch, toRefs } from "vue"
const { isDark } = useData();

const data = reactive({
    heatmap_url: "https://contribution.oooo.so/_/senshinya?chart=calendar&format=svg&weeks=50&theme=green"
})
const { heatmap_url } = toRefs(data);
watch(
    isDark,
    () => {
        if (isDark.value) {
            data.heatmap_url = "https://contribution.oooo.so/_/senshinya?chart=calendar&format=svg&weeks=50&theme=green&dark=true"
        } else {
            data.heatmap_url = "https://contribution.oooo.so/_/senshinya?chart=calendar&format=svg&weeks=50&theme=green"
        }
    },
    {
        immediate: true,
    }
);
</script>

<style scoped lang="scss">

.heatmap-container {
    display: flex;
    flex-direction: column;
    margin-top: 40px;
    max-width: 100%;
}

.heatmap-container-img {
    align-items: center;
}

.heatmap-title {
    text-align: left;
    font-weight: 600;
    margin-left: 1.3rem
}

@media screen and (max-width: 768px) {
    .heatmap-container {
        display: none;
    }
}
</style>