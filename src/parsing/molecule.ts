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

type EliminationError = {
  readonly kind: 'moleculeElimination'
  readonly message: string
}
type ValidationError = {
  readonly kind: 'moleculeValidation'
  readonly message: string
}
export type Error = EliminationError | ValidationError

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

export const applyEliminationRules = (
  molecule: Molecule,
): Either<EliminationError, Option<Molecule>> =>
  transformMolecule(molecule, applyEliminationRule)

// TODO: use distinct types for uneliminated/eliminated keys/values
const eliminateKey = (
  key: Atom,
  alreadyEliminatedValue: Atom | Molecule,
): Either<
  EliminationError,
  Option<readonly [key: Atom, value: Atom | Molecule]>
> => {
  if (key.startsWith('@')) {
    if (key.startsWith('@todo')) {
      return either.makeRight(option.none)
    } else if (key.startsWith('@@')) {
      return either.makeRight(
        option.makeSome([key.substring(1), alreadyEliminatedValue]),
      )
    } else {
      return either.makeLeft({
        kind: 'moleculeElimination',
        message: `unknown rule in key: \`${key}\``,
      })
    }
  } else {
    return either.makeRight(option.makeSome([key, alreadyEliminatedValue]))
  }
}

// TODO: use distinct types for uneliminated/eliminated values
const eliminateValue = (
  value: Atom | Molecule,
): Either<EliminationError, Option<Atom | Molecule>> => {
  if (typeof value === 'string' && value.startsWith('@')) {
    if (value.startsWith('@todo')) {
      return either.makeRight(option.none)
    } else if (value.startsWith('@@')) {
      return either.makeRight(option.makeSome(value.substring(1)))
    } else {
      return either.makeLeft({
        kind: 'moleculeElimination',
        message: `unknown rule in value: \`${value}\``,
      })
    }
  } else if (typeof value === 'object') {
    return either.map(applyEliminationRules(value), option.makeSome)
  } else {
    return either.makeRight(option.makeSome(value))
  }
}

export const applyEliminationRule = (
  key: Atom,
  value: Atom | Molecule,
): Either<
  EliminationError,
  Option<readonly [key: Atom, value: Atom | Molecule]>
> =>
  either.flatMap(eliminateValue(value), potentiallyEliminatedValue =>
    option.match(potentiallyEliminatedValue, {
      none: () => eliminateKey(key, atom.unit),
      some: value => eliminateKey(key, value),
    }),
  )
