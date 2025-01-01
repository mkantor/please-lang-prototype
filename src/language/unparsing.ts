import type { Either } from '../adts.js'
import type { UnserializableValueError } from './errors.js'
import type { Atom, Molecule } from './parsing.js'
import type { Notation } from './unparsing/unparsing-utilities.js'

export { type Notation } from './unparsing/unparsing-utilities.js'

export const unparse = (
  value: Atom | Molecule,
  notation: Notation,
): Either<UnserializableValueError, string> =>
  typeof value === 'object'
    ? notation.molecule(value, notation)
    : notation.atom(value)
