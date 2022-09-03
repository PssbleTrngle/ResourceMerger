import chalk from 'chalk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { emptyDirSync } from 'fs-extra'
import lodash from 'lodash'
import { extname, join, resolve } from 'path'
import { zip } from 'zip-a-folder'
import { Options } from '../cli/config.js'
import { exists, fileHash, listChildren } from '../util.js'
import { getConfig } from './config.js'
import { Mergers } from './merger/index.js'
import LangMerger from './merger/LangMerger.js'
import { default as ModelMerger } from './merger/ModelMerger.js'
import TagMerger from './merger/TagMerger.js'
import ArchiveResolver from './resolver/ArchiveResolver.js'
import FolderResolver from './resolver/FolderResolver.js'

export default async function mergeResources(options: Options) {
   if (!existsSync(options.from)) {
      const missingDirectories = [options.from].map(it => '\n   ' + resolve(it))
      throw new Error(`input directory not found: ${missingDirectories}`)
   }

   const config = getConfig(options.from)
   const packs = listChildren(options.from)
      .map(it => ({ ...it, config: config.packs[it.name] }))
      .filter(it => !it.config?.disabled)

   const folders: string[] = []
   if (options.includeAssets) folders.push('assets')
   if (options.includeData) folders.push('data')

   function resolversOf({ path, name, info, config }: typeof packs[0]) {
      const paths = config?.paths ?? ['.']
      return paths
         .map(relativePath => {
            const realPath = join(path, relativePath)
            if (info.isFile() && ['.zip', '.jar'].includes(extname(name))) return new ArchiveResolver(realPath)
            if (info.isDirectory() && folders.some(it => existsSync(join(realPath, it))))
               return new FolderResolver(realPath)
            return null
         })
         .filter(exists)
   }

   const resolvers = lodash
      .orderBy(packs, it => it.config?.priority ?? 0)
      .flatMap(file => resolversOf(file).map(resolver => ({ ...file, resolver })))
      .filter(exists)

   console.log(`Found ${resolvers.length} resource packs`)

   const outDir = options.zipOutput ? resolve('tmp') : options.output
   emptyDirSync(outDir)

   const mergers = new Mergers(folders, {
      'assets/*/models/**/*.json': ModelMerger,
      'assets/*/lang/**/*.json': LangMerger,
      'data/*/tags/**/*.json': TagMerger,
   })

   const acceptor = mergers.createAcceptor(outDir)

   console.group('Extracting resources...')
   await Promise.all(
      resolvers.map(async ({ resolver, name }) => {
         console.log(name)
         await resolver.extract(acceptor)
      })
   )
   console.groupEnd()

   if (mergers.mergedFiles > 0) console.log(chalk.gray(`Merged ${mergers.mergedFiles} files`))
   if (mergers.overwrittenFiles.length > 0) {
      const patterns = lodash.uniq(
         mergers.overwrittenFiles.map(path => {
            const [base, _, folder] = path.split('/')
            return join(base, '*', folder, '...')
         })
      )
      console.group(chalk.yellow(`Overwritten ${mergers.overwrittenFiles.length} files`))
      patterns.forEach(pattern => {
         console.log(chalk.yellow(pattern))
      })
      console.groupEnd()
   }

   const packData = {
      pack: {
         description: `${options.title} - generated ${new Date().toLocaleDateString()}`,
         pack_format: 8,
      },
   }
   writeFileSync(join(outDir, 'pack.mcmeta'), JSON.stringify(packData, null, 2))

   if (options.zipOutput) {
      console.log('Creating ZIP File...')
      await zip(outDir, options.output)

      const hash = fileHash(readFileSync(options.output), 'sha1')
      console.log(`SHA256: ${hash}`)
   }
}
