import { createResolvers } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import createDefaultMergers from '../merger/default.js'
import getOptions from './config.js'

async function run() {
   const options = getOptions()
   const resolvers = await createResolvers(options)
   const mergers = createDefaultMergers(options)
   const acceptor = mergers.createAcceptor()

   console.group('Extracting resources...')
   await Promise.all(
      resolvers.map(async ({ resolver, name }) => {
         console.log(name)
         await resolver.extract(acceptor)
      })
   )
   console.groupEnd()

   await mergers.finalize()
}

run().catch(async e => {
   console.error(chalk.red(e.message))
})
