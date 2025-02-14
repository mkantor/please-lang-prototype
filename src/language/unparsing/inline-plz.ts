import either from '@matt.kantor/either'
import type { Atom, Molecule } from '../parsing.js'
import {
  closeBrace,
  comma,
  moleculeAsKeyValuePairStrings,
  moleculeUnparser,
  openBrace,
  unparseAtom,
} from './plz-utilities.js'
import type { Notation } from './unparsing-utilities.js'

const unparseSugarFreeMolecule = (value: Molecule) => {
  if (Object.keys(value).length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    return either.map(
      moleculeAsKeyValuePairStrings(value, unparseAtomOrMolecule, {
        ordinalKeys: 'omit',
      }),
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
