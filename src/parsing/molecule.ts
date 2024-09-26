import {
  Type as JSONSchema,
  type Static as TypeOfJSONSchema,
} from '@sinclair/typebox'
import { Value as JSONSchemaValue } from '@sinclair/typebox/value'
import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import type { Atom } from './atom.js'

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

/**
 * Given a callback returning a new key/value pair, incrementally build up a new `Molecule` by
 * walking over every key/value pair in the given `Molecule`.
 */
// TODO: return `Either` with error details on left
const transformMolecule = (
  molecule: Molecule,
  // TODO: `f` needs a way to express "don't add any new properties"; probably returning something
  // like `Either<_, Option<_>>`
  f: (
    key: Atom,
    value: Atom | Molecule,
  ) => Option<readonly [key: Atom, value: Atom | Molecule]>,
): Option<Molecule> => {
  const updatedMolecule: Molecule = {}
  for (let [key, value] of Object.entries(molecule)) {
    const result = f(key, value)
    if (option.isNone(result)) {
      // Immediately bail if we encounter `option.none`.
      return option.none
    }
    option.match(f(key, value), {
      none: () => {},
      some: ([newKey, newValue]) => {
        updatedMolecule[newKey] = newValue
      },
    })
  }
  return option.makeSome(updatedMolecule)
}

export const applyEliminationRules = (molecule: Molecule): Option<Molecule> =>
  transformMolecule(molecule, applyEliminationRule)

// TODO: use distinct types for uneliminated/eliminated keys/values
const eliminateKey = (
  key: Atom,
  alreadyEliminatedValue: Atom | Molecule,
): Option<readonly [key: Atom, value: Atom | Molecule]> => {
  if (key.startsWith('@')) {
    if (key.startsWith('@@')) {
      return option.makeSome([key.substring(1), alreadyEliminatedValue])
    } else {
      return option.none
    }
  } else {
    return option.makeSome([key, alreadyEliminatedValue])
  }
}

// TODO: use distinct types for uneliminated/eliminated values
const eliminateValue = (value: Atom | Molecule): Option<Atom | Molecule> => {
  if (typeof value === 'string' && value.startsWith('@')) {
    if (value.startsWith('@@')) {
      return option.makeSome(value.substring(1))
    } else {
      return option.none
    }
  } else if (typeof value === 'object') {
    return applyEliminationRules(value)
  } else {
    return option.makeSome(value)
  }
}

export const applyEliminationRule = (
  key: Atom,
  value: Atom | Molecule,
): Option<readonly [key: Atom, value: Atom | Molecule]> =>
  option.flatMap(eliminateValue(value), alreadyEliminatedValue =>
    eliminateKey(key, alreadyEliminatedValue),
  )
