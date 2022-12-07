import { Acceptor, ResolverInfo } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { emptyDirSync, ensureDirSync } from 'fs-extra'
import lodash from 'lodash'
import minimatch from 'minimatch'
import { dirname, extname, join } from 'path'
import { zip } from 'zip-a-folder'
import Options from '../options.js'
import { createTempDir, fileHash } from '../util.js'

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
   output: 'merger.zip',
   title: 'Merged',
   packFormat: 9,
   overwrite: true,
}

export class Mergers {
   private readonly outDir: string
   private readonly options: Required<Options>
   private readonly zipOutput: boolean
   private readonly cleanup?: () => void

   constructor(options: Options, private readonly mergers: Record<string, Merger<unknown>>) {
      this.options = { ...defaultOptions, ...options }

      const existingOutputDir = existsSync(this.options.output) && statSync(this.options.output).isDirectory()
      this.zipOutput = !existingOutputDir && ['.zip', '.jar'].includes(extname(this.options.output))

      if (this.zipOutput) {
         const tmp = createTempDir()
         this.outDir = tmp.name
         this.cleanup = tmp.removeCallback
      } else {
         this.outDir = this.options.output
      }
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

   exists(path: string) {
      if (this.zipOutput) return false
      const out = join(this.outDir, path)
      return existsSync(out)
   }

   public createAcceptor(): Acceptor {
      return (path, content) => {
         const out = join(this.outDir, path)
         const cached = existsSync(out)
         if (cached && !this.options.overwrite) return
         ensureDirSync(dirname(out))

         const getContent = () => {
            if (cached) {
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

   public emptyDir() {
      emptyDirSync(this.outDir)
   }

   public async run(resolvers: ResolverInfo[]) {
      this.emptyDir()
      const acceptor = this.createAcceptor()

      console.group('Extracting resources...')
      await Promise.all(
         resolvers.map(async ({ resolver, name }) => {
            console.log(name)
            await resolver.extract(acceptor)
         })
      )
      console.groupEnd()

      await this.finalize()
   }

   public async finalize() {
      if (this.mergedFiles > 0) console.log(chalk.gray(`Merged ${this.mergedFiles} files`))
      if (this.overwrittenFiles.length > 0) {
         const patterns = lodash.uniq(
            this.overwrittenFiles.map(path => {
               const [base, _, folder] = path.split(/[/\\]/)
               if (!folder) return path
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
            pack_format: this.options.packFormat,
         },
      }
      writeFileSync(join(this.outDir, 'pack.mcmeta'), JSON.stringify(packData, null, 2))

      if (this.zipOutput) {
         console.log('Creating ZIP File...')
         await zip(this.outDir, this.options.output)

         const hash = fileHash(readFileSync(this.options.output), 'sha1')
         console.log(`SHA256: ${hash}`)
      }

      this.cleanup?.()
   }
}
