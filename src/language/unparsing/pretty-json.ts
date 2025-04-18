import type { Right } from '@matt.kantor/either'
import either from '@matt.kantor/either'
import kleur from 'kleur'
import type { Atom, Molecule } from '../parsing.js'
import { indent, punctuation, type Notation } from './unparsing-utilities.js'

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const key = (value: Atom): string => {
  const { quote } = punctuation(kleur)
  return quote.concat(kleur.bold(escapeStringContents(value))).concat(quote)
}

const unparseAtom = (value: Atom): Right<string> => {
  const { quote } = punctuation(kleur)
  return either.makeRight(
    quote.concat(
      escapeStringContents(
        /^@[^@]/.test(value) ? kleur.bold(kleur.underline(value)) : value,
      ),
      quote,
    ),
  )
}

const unparseMolecule = (value: Molecule): Right<string> => {
  const { closeBrace, colon, comma, openBrace } = punctuation(kleur)
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return either.makeRight(openBrace.concat(closeBrace))
  } else {
    const keyValuePairs: string = Object.entries(value)
      .map(([propertyKey, propertyValue]) =>
        key(propertyKey)
          .concat(colon)
          .concat(' ')
          .concat(unparseAtomOrMolecule(propertyValue).value),
      )
      .join(comma.concat('\n'))

    return either.makeRight(
      openBrace
        .concat('\n')
        .concat(indent(2, keyValuePairs))
        .concat('\n')
        .concat(closeBrace),
    )
  }
}

const unparseAtomOrMolecule = (value: Atom | Molecule) =>
  typeof value === 'string' ? unparseAtom(value) : unparseMolecule(value)

export const prettyJson: Notation = {
  atom: unparseAtom,
  molecule: unparseMolecule,
}
