import either, { type Either } from '@matt.kantor/either'
import kleur from 'kleur'
import { parseArgs } from 'node:util'
import { type SyntaxTree } from '../parsing/syntax-tree.js'
import {
  prettyJson,
  prettyPlz,
  sugarFreePrettyPlz,
  unparse,
  type Notation,
} from '../unparsing.js'

export const handleOutput = async (
  process: NodeJS.Process,
  command: () => Promise<Either<{ readonly message: string }, SyntaxTree>>,
): Promise<undefined> => {
  const args = parseArgs({
    args: process.argv.slice(2), // remove `execPath` and `filename`
    strict: false,
    options: {
      'no-color': { type: 'boolean' },
      'output-format': { type: 'string' },
    },
  })

  const noColorArg = args.values['no-color'] ?? false
  if (typeof noColorArg !== 'boolean') {
    throw new Error('Unsupported value for --no-color')
  } else if (noColorArg === true) {
    kleur.enabled = false
  }

  const outputFormatArg = args.values['output-format']
  let notation: Notation
  if (outputFormatArg === undefined) {
    throw new Error('Missing required option: --output-format')
  } else if (outputFormatArg === 'json') {
    notation = prettyJson
  } else if (outputFormatArg === 'plz') {
    notation = prettyPlz
  } else if (outputFormatArg === 'sugar-free-plz') {
    notation = sugarFreePrettyPlz
  } else {
    throw new Error(`Unsupported output format: "${outputFormatArg}"`)
  }

  const result = await command()
  return either.match(result, {
    left: error => {
      throw new Error(error.message) // TODO: Improve error reporting.
    },
    right: output => {
      writeOutput(process.stdout, notation, output)
      return undefined
    },
  })
}

export const writeOutput = (
  writeStream: NodeJS.WritableStream,
  notation: Notation,
  output: SyntaxTree,
): void => {
  const outputAsString = unparse(output, notation)
  if (either.isLeft(outputAsString)) {
    throw new Error(outputAsString.value.message)
  } else {
    writeStream.write(outputAsString.value)

    // Writing a newline ensures that output is flushed before terminating, otherwise nothing may be
    // printed to the console. See:
    //  - <https://github.com/nodejs/node/issues/6379>
    //  - <https://github.com/nodejs/node/issues/6456>
    //  - <https://github.com/nodejs/node/issues/2972>
    //  - …and many other near-duplicate issues
    //
    // I've tried other workarounds such as explicitly terminating via `process.exit`, passing a
    // callback to `writeStream.write` (ensuring the returned `Promise` is not resolved until it is
    // called), and explicitly calling `writeStream.end`/`writeStream.uncork` and so far this is the
    // only workaround which reliably results in the desired behavior.
    writeStream.write('\n')
  }
}
