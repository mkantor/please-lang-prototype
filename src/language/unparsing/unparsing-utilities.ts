import { type Either } from '../../adts.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'

export type Notation = {
  readonly atom: (value: Atom) => Either<UnserializableValueError, string>
  readonly molecule: (
    value: Molecule,
    notation: Notation,
  ) => Either<UnserializableValueError, string>
}

export const indent = (spaces: number, textToIndent: string) => {
  const indentation = ' '.repeat(spaces)
  return indentation
    .concat(textToIndent)
    .replace(/(\r?\n)/g, `$1${indentation}`)
}
