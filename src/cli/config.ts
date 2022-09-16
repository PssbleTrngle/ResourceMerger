import { Options as ResolverOptions } from '@pssbletrngle/pack-resolver'
import arg from 'arg'
import { existsSync, readFileSync } from 'fs'
import Options from '../options.js'

const args = arg({
   '--config': String,
   '--include-assets': Boolean,
   '--include-data': Boolean,
   '--from': String,
   '--output': String,
   '-c': '--config',
})

export interface CliOptions extends Options, ResolverOptions {}

function readConfig(configFile?: string) {
   const file = configFile ?? args['--config'] ?? '.mergerrc'
   if (existsSync(file)) {
      const buffer = readFileSync(file)
      return JSON.parse(buffer.toString()) as Partial<CliOptions>
   }
   return null
}

export default function getOptions(configFile?: string): CliOptions {
   const config = readConfig(configFile)
   const output = args['--output'] ?? config?.output ?? 'merged.zip'

   return {
      from: args['--from'] ?? config?.from ?? 'resources',
      includeAssets: args['--include-assets'] ?? config?.includeAssets ?? false,
      includeData: args['--include-data'] ?? config?.includeData ?? false,
      title: 'Test',
      output,
   }
}
