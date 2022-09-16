import { Acceptor } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { emptyDirSync, ensureDirSync } from 'fs-extra'
import lodash from 'lodash'
import minimatch from 'minimatch'
import { dirname, join, resolve } from 'path'
import { zip } from 'zip-a-folder'
import { Options } from '../cli/config'
import { fileHash } from '../util.js'

export interface Merger<T> {
   merge(a: T, b: T): T
   decode(encoded: string | Buffer): T
   encode(encoded: T): string | Buffer
}

export class JsonMerger<T> implements Merger<T> {
   constructor(readonly merge: (a: T, b: T) => T) {}

   decode(encoded: string | Buffer): T {
      return JSON.parse(encoded.toString()) as T
   }

   encode(encoded: T): string | Buffer {
      return JSON.stringify(encoded, null, 2)
   }
}

export class Mergers {
   constructor(
      private readonly options: Omit<Options, 'from'>,
      private readonly mergers: Record<string, Merger<unknown>>
   ) {
      emptyDirSync(this.tempDir)
   }

   private handle<T>(merger: Merger<T>, a: Buffer | string, b: Buffer | string) {
      const merged = merger.merge(merger.decode(a), merger.decode(b))
      return merger.encode(merged)
   }

   private merged = 0
   private overwritten: string[] = []

   public get mergedFiles() {
      return this.merged
   }

   public get overwrittenFiles() {
      return lodash.uniq(this.overwritten)
   }

   private get folders() {
      const folders = []
      if (this.options.includeAssets) folders.push('assets')
      if (this.options.includeData) folders.push('data')
      return folders
   }

   private get tempDir() {
      const outDir = this.options.zipOutput ? resolve('tmp') : this.options.output
      return outDir
   }

   public createAcceptor(): Acceptor {
      return (path, content) => {
         if (!this.folders.some(it => path.startsWith(it))) return

         const out = join(this.tempDir, path)
         ensureDirSync(dirname(out))

         const getContent = () => {
            if (existsSync(out)) {
               const merger = Object.entries(this.mergers).find(([pattern]) => minimatch(path, pattern))?.[1]
               if (merger != null) {
                  const existing = readFileSync(out)
                  const merged = this.handle(merger, existing, content)
                  this.merged++
                  return merged
               } else {
                  this.overwritten.push(path)
                  return content
               }
            } else {
               return content
            }
         }

         writeFileSync(out, getContent())
      }
   }

   async finalize() {
      if (this.mergedFiles > 0) console.log(chalk.gray(`Merged ${this.mergedFiles} files`))
      if (this.overwrittenFiles.length > 0) {
         const patterns = lodash.uniq(
            this.overwrittenFiles.map(path => {
               const [base, _, folder] = path.split('/')
               return join(base, '*', folder, '...')
            })
         )
         console.group(chalk.yellow(`Overwritten ${this.overwrittenFiles.length} files`))
         patterns.forEach(pattern => {
            console.log(chalk.yellow(pattern))
         })
         console.groupEnd()
      }

      const packData = {
         pack: {
            description: `${this.options.title} - generated ${new Date().toLocaleDateString()}`,
            pack_format: 8,
         },
      }
      writeFileSync(join(this.tempDir, 'pack.mcmeta'), JSON.stringify(packData, null, 2))

      if (this.options.zipOutput) {
         console.log('Creating ZIP File...')
         await zip(this.tempDir, this.options.output)

         const hash = fileHash(readFileSync(this.options.output), 'sha1')
         console.log(`SHA256: ${hash}`)
      }
   }
}
