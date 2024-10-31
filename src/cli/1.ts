import * as util from 'node:util'
import { either } from '../adts.js'
import { compile } from '../compiling/compiler.js'
import type { JSONValue } from '../utility-types.js'
import { readJSON } from './jsonInput.js'

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const jsonResult = await readJSON(process.stdin)
  const compilationResult = either.flatMap(jsonResult, compile)
  either.match(compilationResult, {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: (output: JSONValue) => {
      process.stdout.write(
        util.inspect(output, {
          colors: true,
          depth: Infinity,
        }),
      )
    },
  })

  // Writing a newline ensures that output is flushed before terminating, otherwise nothing may be
  // printed to the console. See:
  //  - <https://github.com/nodejs/node/issues/6379>
  //  - <https://github.com/nodejs/node/issues/6456>
  //  - <https://github.com/nodejs/node/issues/2972>
  //  - …and many other near-duplicate issues
  //
  // I've tried other workarounds such as explicitly terminating via `process.exit`, passing a
  // callback to `process.stdout.write` (ensuring the returned `Promise` is not resolved until it
  // is called), and explicitly calling `process.stdout.end`/`process.stdout.uncork` and so far
  // this is the only thing which reliably results in the desired behavior.
  process.stdout.write('\n')
}

await main(process)
