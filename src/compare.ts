import { ArchiveResolver } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import { existsSync } from 'fs'
import { fileHash } from './util.js'

async function compare(reference: string, generated: string) {
   if (!existsSync(reference)) throw new Error('Reference archive missing')

   const pathToHash = new Map<string, string>()
   const hashToPath = new Map<string, string>()

   await new ArchiveResolver(reference).extract((path, content) => {
      const hash = fileHash(content)
      pathToHash.set(path, hash)
      hashToPath.set(hash, path)
   })

   await new ArchiveResolver(generated).extract((path, content) => {
      const hash = fileHash(content)
      if (pathToHash.has(path)) {
         if (hash !== pathToHash.get(path)) {
            console.log(chalk.yellow(`~ '${path}'`))
         }
         pathToHash.delete(path)
      } else {
         const oldPath = hashToPath.get(hash)
         if (oldPath) {
            console.log(chalk.blue(`~ ${oldPath} -> ${path}`))
            pathToHash.delete(oldPath)
         } else console.log(chalk.green(`+ '${path}'`))
      }
   })

   for (const missing of pathToHash.keys()) {
      console.log(chalk.red(`- '${missing}'`))
   }
}

compare('reference.zip', 'server-resources.zip')
