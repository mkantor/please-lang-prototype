import either from '@matt.kantor/either'
import type { Atom, Molecule } from '../parsing.js'
import {
  closeBrace,
  comma,
  moleculeUnparser,
  openBrace,
  sugarFreeMoleculeAsKeyValuePairStrings,
  unparseAtom,
} from './plz-utilities.js'
import type { Notation } from './unparsing-utilities.js'

const unparseSugarFreeMolecule = (value: Molecule) => {
  if (Object.keys(value).length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    return either.map(
      sugarFreeMoleculeAsKeyValuePairStrings(value, unparseAtomOrMolecule),
      keyValuePairsAsStrings =>
        openBrace
          .concat(' ')
          .concat(keyValuePairsAsStrings.join(comma.concat(' ')))
          .concat(' ')
          .concat(closeBrace),
    )
  }
}

const unparseAtomOrMolecule = (value: Atom | Molecule) =>
  typeof value === 'string' ? unparseAtom(value) : unparseMolecule(value)

const unparseMolecule = moleculeUnparser(
  unparseAtomOrMolecule,
  unparseSugarFreeMolecule,
)

export const inlinePlz: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule,
}
