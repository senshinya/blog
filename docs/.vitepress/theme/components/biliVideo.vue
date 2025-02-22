<script setup lang="ts">
const props = defineProps({
    bvid: String,
});

const getUrl = () => {
    return (
        "//player.bilibili.com/player.html?isOutside=true&autoplay=0&bvid=" +
        props.bvid
    );
};
</script>

<template>
    <div class="w-full mt-5" style="height: 400px;">
        <iframe :src="getUrl()" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"
            width="100%" height="100%">
        </iframe>
    </div>
</template>