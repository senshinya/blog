<template>
<div class="bgm-card-skeleton">
	<span class="skeleton-block skeleton-cover" />
	<div class="skeleton-info">
		<span class="skeleton-block skeleton-title" />
		<div class="skeleton-meta">
			<span class="skeleton-block" />
			<span class="skeleton-block" />
		</div>
		<div class="skeleton-summary">
			<span class="skeleton-block" />
			<span class="skeleton-block skeleton-summary-short" />
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.bgm-card-skeleton {
	display: flex;
	overflow: hidden;
	height: 180px;
	border: 1px solid var(--c-border);
	border-radius: 8px;
	background-color: var(--c-bg-3);
}

.skeleton-block {
	display: block;
	position: relative;
	overflow: hidden;
	border-radius: 4px;
	background-color: var(--c-bg-2);

	&::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, var(--c-bg-3), transparent);
		transform: translateX(-100%);
		animation: media-skeleton-shimmer 1.4s infinite linear;
	}
}

.skeleton-cover {
	flex-shrink: 0;
	width: 120px;
	height: 100%;
	border-radius: 0;
}

.skeleton-info {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	padding: 12px;
}

.skeleton-title {
	width: 72%;
	height: 16px;
	margin-bottom: 12px;
}

.skeleton-meta {
	display: flex;
	gap: 12px;

	> .skeleton-block {
		width: 58px;
		height: 10px;
	}

	> .skeleton-block:last-child {
		width: 42px;
	}
}

.skeleton-summary {
	display: flex;
	flex-direction: column;
	gap: 7px;
	margin-top: auto;

	> .skeleton-block {
		height: 11px;
	}
}

.skeleton-summary-short {
	width: 64%;
}

@keyframes media-skeleton-shimmer {
	to {
		transform: translateX(100%);
	}
}

@media (prefers-reduced-motion: reduce) {
	.skeleton-block::after {
		animation: none;
	}
}
</style>
