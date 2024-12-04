import { coloredJSONStringify } from 'colored-json-stringify'
import { parseArgs } from 'util'
import { either, type Either } from '../../adts.js'
import type { JSONValue } from '../../utility-types.js'

export const handleOutput = async (
  process: NodeJS.Process,
  command: () => Promise<Either<{ readonly message: string }, JSONValue>>,
): Promise<undefined> => {
  const args = parseArgs({
    args: process.argv,
    strict: false,
    options: {
      'output-format': { type: 'string' },
    },
  })
  if (args.values['output-format'] === undefined) {
    throw new Error('Missing required option: --output-format')
  } else if (args.values['output-format'] !== 'json') {
    throw new Error(
      `Unsupported output format: "${args.values['output-format']}"`,
    )
  } else {
    const result = await command()
    return either.match(result, {
      left: error => {
        throw new Error(error.message) // TODO: Improve error reporting.
      },
      right: output => {
        writeJSON(process.stdout, output)
        return undefined
      },
    })
  }
}

export const writeJSON = (
  writeStream: NodeJS.WritableStream,
  output: JSONValue,
): void => {
  writeStream.write(coloredJSONStringify(output))

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
