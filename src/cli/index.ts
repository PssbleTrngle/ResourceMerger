import { createResolver } from '@pssbletrngle/pack-resolver'
import chalk from 'chalk'
import createDefaultMergers from '../merger/default.js'
import getOptions from './config.js'

async function run() {
   const options = getOptions()
   const resolvers = createResolver(options)
   const mergers = createDefaultMergers(options)
   await mergers.run(resolvers)
}

run().catch(async e => {
   console.error(chalk.red(e.message))
})
