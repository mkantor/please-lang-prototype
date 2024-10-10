import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import type { Atom } from './atom.js'
import type { ValidationError } from './errors.js'

const moleculeSchema = JSONSchema.Recursive(moleculeSchema =>
  JSONSchema.Record(
    JSONSchema.String(),
    JSONSchema.Union([JSONSchema.String(), moleculeSchema]),
  ),
)

export type Molecule = TypeOfJSONSchema<typeof moleculeSchema>

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
export const transformMolecule = <Error>(
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
