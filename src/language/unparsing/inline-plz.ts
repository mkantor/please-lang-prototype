import either from '@matt.kantor/either'
import { styleText } from 'node:util'
import type { Atom, Molecule } from '../parsing.js'
import {
  moleculeAsKeyValuePairStrings,
  moleculeUnparser,
  unparseAtom,
} from './plz-utilities.js'
import { punctuation, type Notation } from './unparsing-utilities.js'

const unparseSugarFreeMolecule = (value: Molecule) => {
  const { comma, closeBrace, openBrace } = punctuation(styleText)
  if (Object.keys(value).length === 0) {
    return either.makeRight(openBrace + closeBrace)
  } else {
    return either.map(
      moleculeAsKeyValuePairStrings(value, unparseAtomOrMolecule, {
        ordinalKeys: 'omit',
      }),
      keyValuePairsAsStrings =>
        openBrace.concat(
          ' ',
          keyValuePairsAsStrings.join(comma.concat(' ')),
          ' ',
          closeBrace,
        ),
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
