import { type Either } from '@matt.kantor/either'
import * as util from 'node:util'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'

export type Notation = {
  readonly atom: (value: Atom) => Either<UnserializableValueError, string>
  readonly molecule: (
    value: Molecule,
    notation: Notation,
  ) => Either<UnserializableValueError, string>
  readonly suffix: string
}

export const indent = (spaces: number, textToIndent: string) => {
  const indentation = ' '.repeat(spaces)
  return indentation
    .concat(textToIndent)
    .replace(/(\r?\n)/g, `$1${indentation}`)
}

// Note that `node:util`'s `styleText` changes behavior based on the current
// global state of `process.env`, which may be mutated at runtime (e.g. to
// handle `--no-color`).
export const punctuation = (styleText: typeof util.styleText) => ({
  dot: styleText('dim', '.'),
  quote: styleText('dim', '"'),
  colon: styleText('dim', ':'),
  comma: styleText('dim', ','),
  openBrace: styleText('dim', '{'),
  closeBrace: styleText('dim', '}'),
  openParenthesis: styleText('dim', '('),
  closeParenthesis: styleText('dim', ')'),
  arrow: styleText('dim', '=>'),
})
