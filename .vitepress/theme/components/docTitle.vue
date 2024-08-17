<template>
    <div v-show="showTitle">
        <h2>{{ title }}</h2>
        <div v-show="showDate" id="titleDate">
            {{ date }} 发布
        </div>
        <hr>
    </div>
</template>

<script setup lang="ts">
import { reactive, toRefs, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'
const { frontmatter } = useData();
const route = useRoute();

function formatISOToDate(iso: any): string {
    if (typeof iso !== 'string') {
        return '1970-01-01'
    }
    const date = new Date(iso)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const data = reactive({
    title: frontmatter.value?.title,
    date: formatISOToDate(frontmatter.value?.date),
    showTitle: frontmatter.value?.showTitle ?? true,
    showDate: 'date' in frontmatter.value
});
const { title, date, showTitle, showDate } = toRefs(data);
watch(
    () => route.path,
    () => {
        nextTick(() => {
            data.title = frontmatter.value?.title;
            data.date = formatISOToDate(frontmatter.value?.date);
            data.showTitle = frontmatter.value?.showTitle ?? true;
            data.showDate = 'date' in frontmatter.value;
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
    margin-bottom: 0.32em;
    margin-left: 0;
    margin-right: 0;
    font-weight: bold;
    text-align: center;
}

#titleDate {
    text-align: right;
    font-size: 1em;
    margin-bottom: 0.67em;
    color: var(--vp-c-text-2);
}
</style>