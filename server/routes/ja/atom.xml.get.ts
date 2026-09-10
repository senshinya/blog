import { buildAtomFeed } from '../../utils/feed'

export default defineEventHandler(event => buildAtomFeed(event, 'ja'))
