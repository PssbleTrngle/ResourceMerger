import { Options as ResolverOptions } from '@pssbletrngle/pack-resolver'
import arg from 'arg'
import commandLineUsage, { Section } from 'command-line-usage'
import { existsSync, readFileSync } from 'fs'
import Options from '../options.js'

const sections: Section[] = [
   {
      header: 'Resource Merger',
      content: 'Merge multiple resource & datapack into single archive files',
   },
   {
      header: 'Options',
      optionList: [
         {
            name: 'config',
            alias: 'c',
            defaultValue: '.mergerrc',
            typeLabel: '{underline string}',
            description: 'The to read additional options from',
         },
         {
            name: 'include-assets',
            description: 'Include files in the {italic assets} folder',
         },
         {
            name: 'include-data',
            description: 'Include files in the {italic data} folder',
         },
         {
            name: 'from',
            defaultValue: './resources',
            typeLabel: '{underline directory}',
            description: 'The folder to look in for datapacks & resourcepacks',
         },
         {
            name: 'output',
            defaultValue: 'merged.zip',
            typeLabel: '{underline file}',
            description: 'The path of the output archive file',
         },
         {
            name: 'pack-format',
            defaultValue: '9',
            typeLabel: '{underline number}',
            description: 'The {italic pack_format} value written to the generated {italic pack.mcmeta}',
         },
         {
            name: 'help',
            alias: 'h',
            description: 'Print this usage guide.',
         },
      ],
   },
]

export interface CliOptions extends Options, ResolverOptions {}

function readConfig(configFile?: string) {
   const file = configFile ?? '.mergerrc'
   if (existsSync(file)) {
      const buffer = readFileSync(file)
      return JSON.parse(buffer.toString()) as Partial<CliOptions>
   }
   return null
}

export default function getOptions(configFile?: string): CliOptions {
   const args = arg({
      '--config': String,
      '--include-assets': Boolean,
      '--include-data': Boolean,
      '--from': String,
      '--output': String,
      '--pack-format': Number,
      '-c': '--config',
      '--help': Boolean,
      '-h': '--help',
   })

   if (args['--help']) {
      const usage = commandLineUsage(sections)
      console.log(usage)
      process.exit(0)
   }

   const config = readConfig(configFile ?? args['--config'])
   const output = args['--output'] ?? config?.output ?? 'merged.zip'

   return {
      from: args['--from'] ?? config?.from ?? 'resources',
      includeAssets: args['--include-assets'] ?? config?.includeAssets ?? false,
      includeData: args['--include-data'] ?? config?.includeData ?? false,
      title: 'Test',
      packFormat: args['--pack-format'] ?? config?.packFormat,
      output,
   }
}
