import * as util from 'node:util'
import { either, type Either } from '../adts.js'
import type { Code } from '../compiling/code-generation/serialization.js'
import type { JSONValue } from '../utility-types.js'

export const writeJSON = (
  writeStream: NodeJS.WriteStream,
  result: Either<{ readonly message: string }, Code>,
): void => {
  either.match(result, {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: (output: JSONValue) => {
      writeStream.write(
        // TODO: emit valid JSON (colors & formatting would still be nice)
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
  // callback to `writeStream.write` (ensuring the returned `Promise` is not resolved until it is
  // called), and explicitly calling `writeStream.end`/`writeStream.uncork` and so far this is the
  // only workaround which reliably results in the desired behavior.
  writeStream.write('\n')
}
