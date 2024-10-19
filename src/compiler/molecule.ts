import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'
import type { Atom } from './atom.js'
import type { InvalidMoleculeError } from './errors.js'
import type { Canonicalized } from './stages.js'

const moleculeSchema = JSONSchema.Recursive(moleculeSchema =>
  JSONSchema.Union([
    JSONSchema.Record(
      JSONSchema.String(),
      JSONSchema.Union([JSONSchema.String(), moleculeSchema]),
    ),
    JSONSchema.Array(JSONSchema.Union([JSONSchema.String(), moleculeSchema])),
  ]),
)

export type InputMolecule = TypeOfJSONSchema<typeof moleculeSchema>

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

/**
 * Canonicalized molecules are made of (potentially-nested) objects with `string` keys and values.
 *
 * The `InputMolecule` `["a", "b", "c"]` is canonicalized as `{ "0": "a", "1": "b", "2": "c" }`.
 */
export type CanonicalizedMolecule = WithPhantomData<Molecule, Canonicalized>

export const validateMolecule = (
  potentialMolecule: unknown,
): Either<InvalidMoleculeError, InputMolecule> =>
  either.mapLeft(
    either.tryCatch(() =>
      JSONSchemaValue.Decode(moleculeSchema, potentialMolecule),
    ),
    _typeBoxError => ({
      kind: 'invalidMolecule',
      // TODO: build a descriptive message from what TypeBox throws
      message: 'Molecule is not valid',
    }),
  )

export const canonicalizeMolecule = (
  input: InputMolecule,
): CanonicalizedMolecule => {
  const canonicalizedMolecule: Writable<CanonicalizedMolecule> =
    withPhantomData<Canonicalized>()({})
  for (let [key, value] of Object.entries(input)) {
    canonicalizedMolecule[key] =
      typeof value === 'object' ? canonicalizeMolecule(value) : value
  }
  return canonicalizedMolecule
}
