import either from '@matt.kantor/either'
import kleur from 'kleur'
import type { Atom, Molecule } from '../parsing.js'
import {
  moleculeAsKeyValuePairStrings,
  moleculeUnparser,
  unparseAtom,
} from './plz-utilities.js'
import { indent, punctuation, type Notation } from './unparsing-utilities.js'

const unparseSugarFreeMolecule = (value: Molecule) => {
  const { closeBrace, openBrace } = punctuation(kleur)
  if (Object.keys(value).length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    return either.map(
      moleculeAsKeyValuePairStrings(value, unparseAtomOrMolecule, {
        ordinalKeys: 'omit',
      }),
      keyValuePairsAsStrings =>
        openBrace
          .concat('\n')
          .concat(indent(2, keyValuePairsAsStrings.join('\n')))
          .concat('\n')
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

export const prettyPlz: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule,
}
