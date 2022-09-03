import { JsonMerger } from './index.js'

const OverwritingMerger = new JsonMerger<unknown>((a, b) => b)

export default OverwritingMerger
