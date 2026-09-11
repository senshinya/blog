const IMAGE_ORIGIN = 'https://blog-img.774352199.xyz'
const WIDTHS = [480, 768, 960, 1280, 1920]

/** Width descriptors must describe the transformed file, including small originals. */
export function responsiveImage(src: string, originalWidth?: number) {
	if (!src.startsWith(`${IMAGE_ORIGIN}/`) || /\.svg(?:[?#]|$)/i.test(src) || src.includes('/cdn-cgi/image/'))
		return { src, srcset: undefined }
	const widths = [...new Set(WIDTHS.map(width => originalWidth ? Math.min(width, originalWidth) : width))]
	const url = (width: number) => `${IMAGE_ORIGIN}/cdn-cgi/image/width=${width},format=auto${src.slice(IMAGE_ORIGIN.length)}`
	return {
		// The lightbox reads target.src; keep the full-size candidate there.
		src: url(widths.at(-1)!),
		srcset: widths.map(width => `${url(width)} ${width}w`).join(', '),
	}
}
