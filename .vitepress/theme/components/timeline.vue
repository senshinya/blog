<template>
    <ol class="timeline">
        <li class="timeline-item">
            <span class="timeline-item-icon | avatar-icon">
                <i class="avatar">
                    <img src="https://blog-img.shinya.click/1723780121154.jpeg" />
                </i>
            </span>
            <div class="timeline-item-description">
                <span>shinya 巨献</span>
            </div>
        </li>
        <template v-for="item of posts">
            <li class="timeline-item">
                <span class="timeline-item-icon | faded-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                        <path fill="none" d="M0 0h24v24H0z" />
                        <path fill="currentColor"
                            d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z" />
                    </svg>
                </span>
                <div class="timeline-item-description">
                    <span>{{ item.date }} 发布了《<a :href="item.url">{{ item.title }}</a>》<span class="VPBadge tip">#{{ item.category }}</span></span>
                </div>
            </li>
        </template>
    </ol>
</template>

<script setup lang="ts">
import { data as rawPosts } from '../posts.data.mjs'
console.log(rawPosts)
const posts = rawPosts.map(item => ({
    ...item,
    date: item.date.string.substring(0, 10)
}));
</script>

<style lang="scss">
:root {
	--c-grey-100: #f4f6f8;
	--c-grey-200: #e3e3e3;
	--c-grey-300: #b2b2b2;
	--c-grey-400: #7b7b7b;
	--c-grey-500: #3d3d3d;

	--c-blue-500: #688afd;
}

/* Some basic CSS overrides */

/* End basic CSS override */

.timeline {
	width: 100%;
	max-width: 700px;
	margin-left: auto;
	margin-right: auto;
	display: flex;
	flex-direction: column;
	padding: 0 0 32px 32px;
    padding-left: 32px !important;
	border-left: 2px solid var(--c-grey-200);
	font-size: 1rem;
    margin-top: 0 !important;

    img {
        display: block;
        max-width: 100%;
    }
}

.timeline-item {
	display: flex;
	gap: 24px;
    margin-top: 36px !important;
}

.timeline-item-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	margin-left: -52px;
	flex-shrink: 0;
	overflow: hidden;
	box-shadow: 0 0 0 6px #fff;
	svg {
		width: 20px;
		height: 20px;
	}

	&.faded-icon {
		background-color: var(--c-grey-100);
		color: var(--c-grey-400);
	}

	&.filled-icon {
		background-color: var(--c-blue-500);
		color: #fff;
	}
}

.timeline-item-description {
	display: flex;
	padding-top: 10px;
	gap: 8px;
	color: var(--c-grey-400);

	img {
		flex-shrink: 0;
	}
	a {
		color: var(--c-grey-500);
		font-weight: 500;
		text-decoration: none;
		&:hover,
		&:focus {
			outline: 0; // Don't actually do this
			color: var(--c-blue-500);
		}
	}
}

.avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	overflow: hidden;
	aspect-ratio: 1 / 1;
	flex-shrink: 0;
	width: 40px;
	height: 40px;
	&.small {
		width: 28px;
		height: 28px;
	}

	img {
		object-fit: cover;
	}
}

</style>