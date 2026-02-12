import type { Either } from '@matt.kantor/either'
import either from '@matt.kantor/either'
import type { UnserializableValueError } from './errors.js'
import type { Atom, Molecule } from './parsing.js'
import type { Notation } from './unparsing/unparsing-utilities.js'

export { inlinePlz } from './unparsing/inline-plz.js'
export { prettyJson } from './unparsing/pretty-json.js'
export { prettyPlz } from './unparsing/pretty-plz.js'
export { sugarFreePrettyPlz } from './unparsing/sugar-free-pretty-plz.js'
export type { Notation } from './unparsing/unparsing-utilities.js'

export const unparse = (
  value: Atom | Molecule,
  notation: Notation,
): Either<UnserializableValueError, string> =>
  either.map(
    typeof value === 'object' ?
      notation.molecule(value, notation)
    : notation.atom(value),
    output => output.concat(notation.suffix),
  )
