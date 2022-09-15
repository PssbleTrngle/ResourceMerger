import lodash from 'lodash'
import { JsonMerger } from './index.js'

export interface TagDefinition {
   replace?: boolean
   values: Array<
      | string
      | {
           value: string
           required?: boolean
        }
   >
}

const TagMerger = new JsonMerger<TagDefinition>((a, b) => {
   if (b.replace) return b
   return {
      replace: a.replace,
      values: lodash.uniq([...a.values, ...b.values]),
   }
})

export default TagMerger
