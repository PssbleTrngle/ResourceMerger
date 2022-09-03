import { existsSync, readFileSync, writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import lodash from 'lodash'
import minimatch from 'minimatch'
import { dirname, join } from 'path'
import { Acceptor } from '../resolver/IResolver'

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
   constructor(private readonly folders: string[], private readonly mergers: Record<string, Merger<unknown>>) {}

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

   createAcceptor(tempDir: string): Acceptor {
      return (path, content) => {
         if (!this.folders.some(it => path.startsWith(it))) return

         const out = join(tempDir, path)
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
}
