import { parseArgs } from 'util'
import { either, type Either } from '../../adts.js'
import { type JsonValueForbiddingSymbolicKeys } from '../parsing.js'

export type InvalidJsonError = {
  readonly kind: 'invalidJson'
  readonly message: string
}

export const handleInput = async <Result>(
  process: NodeJS.Process,
  command: (input: JsonValueForbiddingSymbolicKeys) => Result,
): Promise<Result> => {
  const args = parseArgs({
    args: process.argv.slice(2), // remove `execPath` and `filename`
    strict: false,
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
    const input = await readJson(process.stdin)
    return either.match(input, {
      left: error => {
        throw new Error(error.message) // TODO: Improve error reporting.
      },
      right: command,
    })
  }
}

export const readJson = async (
  stream: AsyncIterable<string>,
): Promise<Either<InvalidJsonError, JsonValueForbiddingSymbolicKeys>> =>
  parseJson(await readString(stream))

export const readString = async (
  stream: AsyncIterable<string>,
): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const parseJson = (
  source: string,
): Either<InvalidJsonError, JsonValueForbiddingSymbolicKeys> =>
  either.mapLeft(
    either.tryCatch((): JsonValueForbiddingSymbolicKeys => JSON.parse(source)),
    jsonParseError => ({
      kind: 'invalidJson',
      message:
        jsonParseError instanceof Error
          ? jsonParseError.message
          : 'Invalid JSON',
    }),
  )
