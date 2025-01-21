import type { Right } from '@matt.kantor/either'
import either from '@matt.kantor/either'
import kleur from 'kleur'
import type { Atom, Molecule } from '../parsing.js'
import { indent, type Notation } from './unparsing-utilities.js'

const quote = kleur.dim('"')
const colon = kleur.dim(':')
const comma = kleur.dim(',')
const openBrace = kleur.dim('{')
const closeBrace = kleur.dim('}')

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const key = (value: Atom): string =>
  quote.concat(kleur.bold(escapeStringContents(value))).concat(quote)

const atom = (value: Atom): Right<string> =>
  either.makeRight(
    quote.concat(
      escapeStringContents(
        /^@[^@]/.test(value) ? kleur.bold(kleur.underline(value)) : value,
      ),
      quote,
    ),
  )

const molecule = (value: Molecule): Right<string> => {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return either.makeRight(openBrace.concat(closeBrace))
  } else {
    const keyValuePairs: string = Object.entries(value)
      .map(([propertyKey, propertyValue]) =>
        key(propertyKey)
          .concat(colon)
          .concat(' ')
          .concat(atomOrMolecule(propertyValue).value),
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

const atomOrMolecule = (value: Atom | Molecule) =>
  typeof value === 'string' ? atom(value) : molecule(value)

export const prettyJson: Notation = { atom, molecule }
