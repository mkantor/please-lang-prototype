import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'

const moleculeSchema = JSONSchema.Recursive(moleculeSchema =>
  JSONSchema.Record(
    JSONSchema.String(),
    JSONSchema.Union([JSONSchema.String(), moleculeSchema]),
  ),
)

export type Molecule = TypeOfJSONSchema<typeof moleculeSchema>

// TODO: evolve this into `validateMolecule`, returning an `Either` with error details on the left
export const asMolecule = (potentialMolecule: unknown): Option<Molecule> => {
  try {
    const molecule = JSONSchemaValue.Decode(moleculeSchema, potentialMolecule)
    return option.makeSome(molecule)
  } catch (_error) {
    return option.none
  }
}
