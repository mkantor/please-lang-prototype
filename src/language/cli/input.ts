import either, { type Either } from '@matt.kantor/either'
import { parseArgs } from 'node:util'
import * as orderedRecord from '../../ordered-record.js'
import { parseJson, type Atom, type Molecule } from '../parsing.js'
import type { ParsedJsonValue } from '../parsing/json.js'

export type InvalidJsonError = {
  readonly kind: 'invalidJson'
  readonly message: string
}

export const handleInput = async <Result>(
  process: NodeJS.Process,
  command: (input: Atom | Molecule) => Result,
): Promise<Result> => {
  const args = parseArgs({
    args: process.argv.slice(2), // remove `execPath` and `filename`
    strict: false,
    options: {
      'input-format': { type: 'string' },
    },
  })

  // Only JSON is supported currently. `--input-format` isn't really necessary
  // right now, but requiring it ensures forwards-compatibility of scripts when
  // other formats are added.
  if (args.values['input-format'] === undefined) {
    throw new Error('Missing required option: --input-format')
  } else if (args.values['input-format'] !== 'json') {
    throw new Error(
      `Unsupported input format: "${args.values['input-format']}"`,
    )
  } else {
    return either.match(
      either.map(await readJson(process.stdin), jsonValueToAtomOrMolecule),
      {
        left: error => {
          throw new Error(error.message) // TODO: Improve error reporting.
        },
        right: command,
      },
    )
  }
}

export const readJson = async (
  stream: AsyncIterable<string>,
): Promise<Either<InvalidJsonError, ParsedJsonValue>> =>
  either.mapLeft(parseJson(await readString(stream)), parseError => ({
    kind: 'invalidJson',
    message: parseError.message,
  }))

export const readString = async (
  stream: AsyncIterable<string>,
): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

/**
 * Deeply-convert `ParsedJsonValue`s to `Atom | Molecule`s. All non-`string`
 * primitives are converted to strings, and arrays become `OrderedRecord`s with
 * `"0"`, `"1"`, … keys.
 */
const jsonValueToAtomOrMolecule = (value: ParsedJsonValue): Atom | Molecule =>
  isArrayOfParsedJsonValues(value) ?
    orderedRecord.make(
      value.map((element, index) => [
        String(index),
        jsonValueToAtomOrMolecule(element),
      ]),
    )
  : orderedRecord.isOrderedRecord(value) ?
    orderedRecord.mapValues(value, jsonValueToAtomOrMolecule)
  : String(value satisfies string | number | boolean | null)

const isArrayOfParsedJsonValues = (
  value: ParsedJsonValue,
): value is readonly ParsedJsonValue[] => Array.isArray(value)
