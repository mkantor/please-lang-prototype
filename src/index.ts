import * as util from 'node:util'
import type { Either } from './adts/either.js'
import * as either from './adts/either.js'
import * as compiler from './compiler/index.js'

const read = async (stream: AsyncIterable<string>): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const handleInput = (
  source: string,
): Either<{ readonly message: string }, compiler.CanonicalizedMolecule> =>
  either.map(
    either.flatMap(
      either.mapLeft(
        either.tryCatch((): unknown => JSON.parse(source)),
        jsonParseError => ({
          message:
            jsonParseError instanceof Error
              ? jsonParseError.message
              : 'Invalid JSON',
        }),
      ),
      compiler.validateMolecule,
    ),
    compiler.canonicalizeMolecule,
  )

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const rawInput = await read(process.stdin)
  either.match(either.flatMap(handleInput(rawInput), compiler.applyKeywords), {
    left: error => {
      throw new Error(error.message) // TODO: improve error reporting
    },
    right: output => {
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
