import { either, type Either } from '../adts.js'
import { type JSONValueForbiddingSymbolicKeys } from '../parsing.js'

export const readJSON = async (
  stream: AsyncIterable<string>,
): Promise<
  Either<{ readonly message: string }, JSONValueForbiddingSymbolicKeys>
> => parseJSON(await readString(stream))

export const readString = async (stream: AsyncIterable<string>) => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const parseJSON = (source: string) =>
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
