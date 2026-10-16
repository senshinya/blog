import type { Ref } from 'vue'
import { onScopeDispose, watch } from 'vue'

/** Fit reading photos into the space left by their caption, paper and page padding. */
export function useTravelPhotoFit(root: Ref<HTMLElement | null>, content: Readonly<Ref<unknown>>) {
	let detach = () => {}
	watch([root, content], () => {
		detach()
		detach = () => {}
		const element = root.value
		const viewport = element?.querySelector<HTMLElement>('.story-scroll')
		const win = element?.ownerDocument.defaultView
		if (!element || !viewport || !win)
			return
		const photos = [...element.querySelectorAll<HTMLElement>('.story-photo')].flatMap((figure) => {
			const paper = figure.querySelector<HTMLElement>('.photo-open')
			const caption = figure.querySelector<HTMLElement>('figcaption')
			return paper && caption ? [{ figure, paper, caption, original: paper.style.getPropertyValue('--photo-height-limit') }] : []
		})
		let frame = 0
		const pixels = (value: string) => Number.parseFloat(value) || 0
		function fit() {
			frame = 0
			if (!viewport!.clientHeight)
				return
			const heights = photos.map(({ figure, paper, caption }) => {
				const layout = win!.getComputedStyle(figure)
				const notes = win!.getComputedStyle(caption)
				const style = win!.getComputedStyle(paper)
				const sideBySide = layout.display === 'grid' && layout.gridTemplateColumns.trim().split(/\s+/).length > 1
				const captionHeight = sideBySide ? 0 : caption.offsetHeight + pixels(notes.marginTop) + pixels(notes.marginBottom) + pixels(layout.rowGap)
				const padding = pixels(layout.paddingTop) + pixels(layout.paddingBottom)
				const edge = pixels(style.paddingTop) + pixels(style.paddingBottom) + pixels(style.borderTopWidth) + pixels(style.borderBottomWidth)
				const maximum = pixels(style.getPropertyValue('--photo-max-height')) || viewport!.clientHeight
				const fraction = pixels(style.getPropertyValue('--photo-viewport-fraction')) || 1
				// Keep a small allowance for the paper's resting tilt and hover scale.
				const available = viewport!.clientHeight - padding - captionHeight - edge - 24
				return Math.floor(Math.min(maximum, viewport!.clientHeight * fraction, Math.max(120, available)))
			})
			photos.forEach(({ paper }, index) => {
				const height = `${heights[index]}px`
				if (paper.style.getPropertyValue('--photo-height-limit') !== height)
					paper.style.setProperty('--photo-height-limit', height)
			})
		}
		function schedule() {
			if (!frame)
				frame = win!.requestAnimationFrame(fit)
		}
		const observer = new win.ResizeObserver(schedule)
		observer.observe(viewport)
		photos.forEach(({ caption }) => observer.observe(caption))
		schedule()
		detach = () => {
			observer.disconnect()
			if (frame)
				win.cancelAnimationFrame(frame)
			frame = 0
			photos.forEach(({ paper, original }) => {
				if (original)
					paper.style.setProperty('--photo-height-limit', original)
				else paper.style.removeProperty('--photo-height-limit')
			})
		}
	}, { immediate: true, flush: 'post' })
	onScopeDispose(() => detach())
}
