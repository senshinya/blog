import type { ExpressionSpecification } from 'maplibre-gl'

/** CARTO/OpenMapTiles stores translations separately from the local name. */
export function getTravelMapLabelField(locale: string): ExpressionSpecification {
	const language = ['zh', 'en', 'ja'].includes(locale) ? locale : 'zh'
	const fields = [
		`name:${language}`,
		...(language === 'en' ? ['name_en'] : []),
		'name',
		'name:latin',
	]
	// Skip empty translations as well as absent fields. All result branches stay
	// strings so this expression also validates against text-field's formatted type.
	return ['case', ...fields.flatMap(field => [
		['!=', ['coalesce', ['get', field], ''], ''],
		['get', field],
	]), ''] as ExpressionSpecification
}
