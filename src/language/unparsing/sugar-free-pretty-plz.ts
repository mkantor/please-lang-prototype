import either from '@matt.kantor/either'
import { styleText } from 'node:util'
import type { Atom, Molecule } from '../parsing.js'
import { moleculeAsKeyValuePairStrings, unparseAtom } from './plz-utilities.js'
import { indent, punctuation, type Notation } from './unparsing-utilities.js'

const unparseMolecule = (value: Molecule) => {
  const { closeBrace, openBrace } = punctuation(styleText)
  if (Object.keys(value).length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    return either.map(
      moleculeAsKeyValuePairStrings(value, unparseAtomOrMolecule, {
        ordinalKeys: 'preserve',
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

export const sugarFreePrettyPlz: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule,
}
