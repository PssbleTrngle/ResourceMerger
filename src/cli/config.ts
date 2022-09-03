import arg from 'arg'
import { existsSync, readFileSync, statSync } from 'fs'
import { extname } from 'path'

const args = arg({
   '--config': String,
   '--include-assets': Boolean,
   '--include-data': Boolean,
   '--from': String,
   '--output': String,
   '-c': '--config',
})

export interface Options {
   from: string
   output: string
   includeAssets: boolean
   includeData: boolean
   title: string
   zipOutput: boolean
}

function readConfig() {
   const file = args['--config'] ?? '.mergerrc'
   if (existsSync(file)) {
      const buffer = readFileSync(file)
      return JSON.parse(buffer.toString()) as Partial<Options>
   }
   return null
}
export default function getOptions(): Options {
   const config = readConfig()
   const output = args['--output'] ?? config?.output ?? 'merged.zip'
   const existingOutputDir = existsSync(output) && statSync(output).isDirectory()

   return {
      from: args['--from'] ?? config?.from ?? 'resources',
      includeAssets: args['--include-assets'] ?? config?.includeAssets ?? false,
      includeData: args['--include-data'] ?? config?.includeData ?? false,
      title: 'Test',
      output,
      zipOutput: !existingOutputDir && ['.zip', '.jar'].includes(extname(output)),
   }
}
