import chalk from 'chalk'
import mergeResources from '../pack/index.js'
import getOptions from './config.js'

async function run() {
   const options = getOptions()
   await mergeResources(options)
}

run().catch(async e => {
   console.error(chalk.red(e.message))
})
