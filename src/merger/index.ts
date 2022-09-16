import { Acceptor } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import lodash from 'lodash'
import minimatch from 'minimatch'
import { dirname, extname, join, resolve } from 'path'
import { zip } from 'zip-a-folder'
import Options from '../options.js'
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

const defaultOptions: Required<Options> = {
   includeAssets: false,
   includeData: false,
   output: 'merger.zip',
   title: 'Merged',
}

export class Mergers {
   private readonly tempDir: string
   private readonly folders: ReadonlyArray<string>
   private readonly options: Required<Options>
   private readonly zipOutput: boolean

   constructor(options: Options, private readonly mergers: Record<string, Merger<unknown>>) {
      this.options = { ...defaultOptions, ...options }

      const existingOutputDir = existsSync(this.options.output) && statSync(this.options.output).isDirectory()
      this.zipOutput = !existingOutputDir && ['.zip', '.jar'].includes(extname(this.options.output))

      this.tempDir = this.zipOutput ? resolve('tmp') : this.options.output

      const folders = []
      if (this.options.includeAssets) folders.push('assets')
      if (this.options.includeData) folders.push('data')
      this.folders = folders
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

   public get overwrittenFiles(): ReadonlyArray<string> {
      return lodash.uniq(this.overwritten)
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

      if (this.zipOutput) {
         console.log('Creating ZIP File...')
         await zip(this.tempDir, this.options.output)

         const hash = fileHash(readFileSync(this.options.output), 'sha1')
         console.log(`SHA256: ${hash}`)
      }
   }
}
