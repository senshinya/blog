<template>
    <div v-show="showTitle">
        <h2>{{ title }}</h2>
        <hr>
    </div>
</template>

<script setup lang="ts">
import { reactive, toRefs, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'
const { frontmatter } = useData();
const route = useRoute();
const data = reactive({
    title: frontmatter.value?.title,
    showTitle: frontmatter.value?.showTitle ?? true,
});
const { title, showTitle } = toRefs(data);
watch(
    () => route.path,
    () => {
        nextTick(() => {
            data.title = frontmatter.value?.title;
            data.showTitle = frontmatter.value?.showTitle ?? true;
        });
    },
    {
        immediate: true,
    }
);
</script>
<style scoped>
h2 {
    display: block;
    font-size: 2em;
    line-height: 1em;
    margin-top: 0.67em;
    margin-bottom: 0.67em;
    margin-left: 0;
    margin-right: 0;
    font-weight: bold;
}
</style>