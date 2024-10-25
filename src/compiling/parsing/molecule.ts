import type { Atom } from './atom.js'

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

export const unit: Molecule = {}
