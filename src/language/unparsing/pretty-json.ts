import type { Right } from '@matt.kantor/either'
import either from '@matt.kantor/either'
import { styleText } from 'node:util'
import type { Atom, Molecule } from '../parsing.js'
import { indent, punctuation, type Notation } from './unparsing-utilities.js'

const escapeStringContents = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')

const key = (value: Atom): string => {
  const { quote } = punctuation(styleText)
  return quote.concat(styleText('bold', escapeStringContents(value)), quote)
}

const unparseAtom = (value: Atom): Right<string> => {
  const { quote } = punctuation(styleText)
  return either.makeRight(
    quote.concat(
      escapeStringContents(
        /^@[^@]/.test(value) ? styleText(['bold', 'underline'], value) : value,
      ),
      quote,
    ),
  )
}

const unparseMolecule = (value: Molecule): Right<string> => {
  const { closeBrace, colon, comma, openBrace } = punctuation(styleText)
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return either.makeRight(openBrace.concat(closeBrace))
  } else {
    const keyValuePairs: string = Object.entries(value)
      .map(([propertyKey, propertyValue]) =>
        key(propertyKey).concat(
          colon,
          ' ',
          unparseAtomOrMolecule(propertyValue).value,
        ),
      )
      .join(comma.concat('\n'))

    return either.makeRight(
      openBrace.concat('\n', indent(2, keyValuePairs), '\n', closeBrace),
    )
  }
}

const unparseAtomOrMolecule = (value: Atom | Molecule) =>
  typeof value === 'string' ? unparseAtom(value) : unparseMolecule(value)

export const prettyJson: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule,
  suffix: '\n',
}
