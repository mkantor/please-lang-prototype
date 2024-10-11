import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { ValidationError } from './errors.js'

const moleculeSchema = JSONSchema.Recursive(moleculeSchema =>
  JSONSchema.Record(
    JSONSchema.String(),
    JSONSchema.Union([JSONSchema.String(), moleculeSchema]),
  ),
)

export type Molecule = TypeOfJSONSchema<typeof moleculeSchema>
export type UncompiledMolecule = Molecule & {
  // Uncompiled molecules should not have symbolic keys. This type doesn't robustly guarantee that
  // (because of upcasting), but will catch simple mistakes like directly using an `Option<…>` as
  // an `UncompiledMolecule`.
  //
  // Instead of this the `UncompiledMolecule` type could have a full-fledged brand/discriminant,
  // but that makes some APIs harder to use with object literals.
  //
  // TODO: decide whether APIs like this will be publicly exposed or not; if only tests need to
  // call them then using a real brand is a worthwhile tradeoff
  readonly [key: symbol]: undefined
}

export const validateMolecule = (
  potentialMolecule: unknown,
): Either<ValidationError, UncompiledMolecule> =>
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
