import * as option from '../adts/option.js'
import { type Option } from '../adts/option.js'
import * as atom from './atom.js'
import { type Atom } from './atom.js'

export type Molecule = {
  readonly [key: Atom]: Atom | Molecule
}

// TODO: evolve this into `validateMolecule`, returning an `Either` with error details on the left
export const asMolecule = (potentialMolecule: unknown): Option<Molecule> => {
  if (
    potentialMolecule === null ||
    typeof potentialMolecule !== 'object' ||
    Array.isArray(potentialMolecule)
  ) {
    return option.none
  }

  for (let [key, value] of Object.entries(potentialMolecule)) {
    if (!atom.isAtom(key) || (!atom.isAtom(value) && !isMolecule(value))) {
      return option.none
    }
    ;({ [key]: value }) satisfies Molecule // sanity check (since there's an assertion below)
  }

  // If execution gets here `potentialMolecule` must be a valid `Molecule`.
  return option.makeSome(potentialMolecule as Molecule)
}

const isMolecule = (value: unknown): value is Molecule =>
  option.match(asMolecule(value), {
    none: () => false,
    some: _ => true,
  })
