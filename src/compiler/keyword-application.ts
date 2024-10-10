import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import type { Atom } from './atom.js'
import * as atom from './atom.js'
import type { UnknownKeywordError } from './errors.js'
import type { Molecule } from './molecule.js'
import { transformMolecule } from './molecule.js'

export const applyKeywords = (
  molecule: Molecule,
): Either<UnknownKeywordError, Option<Molecule>> =>
  transformMolecule(molecule, (key, value) =>
    // Eliminated values become the unit value; eliminated keys omit the whole property.
    either.flatMap(applyValueKeywords(value), potentiallyEliminatedValue =>
      option.match(potentiallyEliminatedValue, {
        none: () => applyKeyKeywords(key, atom.unit),
        some: value => applyKeyKeywords(key, value),
      }),
    ),
  )

// TODO: use distinct types for applied/unapplied keywords
const applyKeyKeywords = (
  key: Atom,
  valueWithKeywordsApplied: Atom | Molecule,
): Either<
  UnknownKeywordError,
  Option<readonly [key: Atom, value: Atom | Molecule]>
> => {
  if (key.startsWith('@')) {
    if (key.startsWith('@todo')) {
      return either.makeRight(option.none)
    } else if (key.startsWith('@@')) {
      return either.makeRight(
        option.makeSome([key.substring(1), valueWithKeywordsApplied]),
      )
    } else {
      return either.makeLeft({
        kind: 'unknownKeyword',
        message: `unknown keyword in key: \`${key}\``,
      })
    }
  } else {
    return either.makeRight(option.makeSome([key, valueWithKeywordsApplied]))
  }
}

// TODO: use distinct types for applied/unapplied keywords
const applyValueKeywords = (
  value: Atom | Molecule,
): Either<UnknownKeywordError, Option<Atom | Molecule>> => {
  if (typeof value === 'string' && value.startsWith('@')) {
    if (value.startsWith('@todo')) {
      return either.makeRight(option.none)
    } else if (value.startsWith('@@')) {
      return either.makeRight(option.makeSome(value.substring(1)))
    } else {
      return either.makeLeft({
        kind: 'unknownKeyword',
        message: `unknown keyword in value: \`${value}\``,
      })
    }
  } else if (typeof value === 'object') {
    return applyKeywords(value)
  } else {
    return either.makeRight(option.makeSome(value))
  }
}
