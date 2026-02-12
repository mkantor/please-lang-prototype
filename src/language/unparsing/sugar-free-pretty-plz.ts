import either from '@matt.kantor/either'
import { styleText } from 'node:util'
import type { Molecule } from '../parsing.js'
import {
  moleculeAsKeyValuePairStrings,
  unparseAtom,
  type SemanticContext,
  type UnparseAtomOrMolecule,
} from './plz-utilities.js'
import { indent, punctuation, type Notation } from './unparsing-utilities.js'

const unparseMolecule =
  (semanticContext: SemanticContext) => (value: Molecule) => {
    const { closeBrace, openBrace } = punctuation(styleText)
    if (Object.keys(value).length === 0) {
      return either.makeRight(openBrace + closeBrace)
    } else {
      return either.map(
        moleculeAsKeyValuePairStrings(
          value,
          { unparseAtomOrMolecule, semanticContext },
          {
            ordinalKeys: 'preserve',
          },
        ),
        keyValuePairsAsStrings =>
          openBrace.concat(
            '\n',
            indent(2, keyValuePairsAsStrings.join('\n')),
            '\n',
            closeBrace,
          ),
      )
    }
  }

const unparseAtomOrMolecule: UnparseAtomOrMolecule =
  semanticContext => value =>
    typeof value === 'string' ?
      unparseAtom(value)
    : unparseMolecule(semanticContext)(value)

export const sugarFreePrettyPlz: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule('default'),
  suffix: '\n',
}
