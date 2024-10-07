import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import * as either from '../adts/either.js'
import { type Either } from '../adts/either.js'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import type { Atom } from './atom.js'
import * as atom from './atom.js'

const moleculeSchema = JSONSchema.Recursive(moleculeSchema =>
  JSONSchema.Record(
    JSONSchema.String(),
    JSONSchema.Union([JSONSchema.String(), moleculeSchema]),
  ),
)

export type Molecule = TypeOfJSONSchema<typeof moleculeSchema>

type UnknownKeywordError = {
  readonly kind: 'unknownKeyword'
  readonly message: string
}
type ValidationError = {
  readonly kind: 'moleculeValidation'
  readonly message: string
}
export type Error = UnknownKeywordError | ValidationError

export const validateMolecule = (
  potentialMolecule: unknown,
): Either<ValidationError, Molecule> =>
  either.mapLeft(
    either.tryCatch(() =>
      JSONSchemaValue.Decode(moleculeSchema, potentialMolecule),
    ),
    _typeBoxError => ({
      kind: 'moleculeValidation',
      // TODO: build a descriptive message from what TypeBox throws
      message: 'Molecule is not valid',
    }),
  )

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

/**
 * Given a callback returning a new key/value pair, incrementally build up a new `Molecule` by
 * walking over every key/value pair in the given `Molecule`.
 */
const transformMolecule = <Error>(
  molecule: Molecule,
  f: (
    key: Atom,
    value: Atom | Molecule,
  ) => Either<Error, Option<readonly [key: Atom, value: Atom | Molecule]>>,
): Either<Error, Option<Molecule>> => {
  const updatedMolecule: Molecule = {}
  for (let [key, value] of Object.entries(molecule)) {
    const result = f(key, value)
    if (either.isLeft(result)) {
      // Immediately bail if an error is encountered.
      return result
    }
    option.match(result.value, {
      none: () => {},
      some: ([newKey, newValue]) => {
        updatedMolecule[newKey] = newValue
      },
    })
  }
  return either.makeRight(option.makeSome(updatedMolecule))
}

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
    return either.map(applyKeywords(value), option.makeSome)
  } else {
    return either.makeRight(option.makeSome(value))
  }
}
