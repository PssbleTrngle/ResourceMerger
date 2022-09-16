import { Options } from '../cli/config.js'
import { Mergers } from './index.js'
import LangMerger from './LangMerger.js'
import ModelMerger from './ModelMerger.js'
import TagMerger from './TagMerger.js'

export default function createDefaultMergers(options: Omit<Options, 'from'>) {
   return new Mergers(options, {
      'assets/*/models/**/*.json': ModelMerger,
      'assets/*/lang/**/*.json': LangMerger,
      'data/*/tags/**/*.json': TagMerger,
   })
}
