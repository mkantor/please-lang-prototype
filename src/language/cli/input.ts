import { parseArgs } from 'util'
import { either, type Either } from '../../adts.js'
import { type JSONValueForbiddingSymbolicKeys } from '../parsing.js'

export type InvalidJsonError = {
  readonly kind: 'invalidJSON'
  readonly message: string
}

export const handleInput = async <Result>(
  process: NodeJS.Process,
  command: (input: JSONValueForbiddingSymbolicKeys) => Result,
): Promise<Result> => {
  const args = parseArgs({
    args: process.argv.slice(2), // remove `execPath` and `filename`
    options: {
      'input-format': { type: 'string' },
    },
  })
  if (args.values['input-format'] === undefined) {
    throw new Error('Missing required option: --input-format')
  } else if (args.values['input-format'] !== 'json') {
    throw new Error(
      `Unsupported input format: "${args.values['input-format']}"`,
    )
  } else {
    const input = await readJSON(process.stdin)
    return either.match(input, {
      left: error => {
        throw new Error(error.message) // TODO: Improve error reporting.
      },
      right: command,
    })
  }
}

export const readJSON = async (
  stream: AsyncIterable<string>,
): Promise<Either<InvalidJsonError, JSONValueForbiddingSymbolicKeys>> =>
  parseJSON(await readString(stream))

export const readString = async (
  stream: AsyncIterable<string>,
): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const parseJSON = (
  source: string,
): Either<InvalidJsonError, JSONValueForbiddingSymbolicKeys> =>
  either.mapLeft(
    either.tryCatch((): JSONValueForbiddingSymbolicKeys => JSON.parse(source)),
    jsonParseError => ({
      kind: 'invalidJSON',
      message:
        jsonParseError instanceof Error
          ? jsonParseError.message
          : 'Invalid JSON',
    }),
  )
