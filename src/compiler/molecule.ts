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

export type Molecule = TypeOfJSONSchema<typeof moleculeSchema> & {
  // Molecules should not have symbolic keys. This type doesn't robustly guarantee that (because of
  // upcasting), but should help catch obvious mistakes like using an `Option<Molecule>` as a
  // `Molecule`.
  //
  // Instead of this the `Molecule` type could have a full-fledged brand/discriminant, but that
  // makes some APIs harder to use with object literals.
  //
  // TODO: decide whether APIs like this will be publicly exposed or not; if only tests need to
  // call them then using a real brand is a worthwhile tradeoff
  readonly [key: symbol]: undefined
}

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
