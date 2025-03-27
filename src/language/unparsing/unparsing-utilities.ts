import { type Either } from '@matt.kantor/either'
import type { Kleur } from 'kleur'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'

export type Notation = {
  readonly atom: (value: Atom) => Either<UnserializableValueError, string>
  readonly molecule: (
    value: Molecule,
    notation: Notation,
  ) => Either<UnserializableValueError, string>
}

export const indent = (spaces: number, textToIndent: string) => {
  const indentation = ' '.repeat(spaces)
  return indentation
    .concat(textToIndent)
    .replace(/(\r?\n)/g, `$1${indentation}`)
}

export const punctuation = (kleur: Kleur) => ({
  dot: kleur.dim('.'),
  quote: kleur.dim('"'),
  colon: kleur.dim(':'),
  comma: kleur.dim(','),
  openBrace: kleur.dim('{'),
  closeBrace: kleur.dim('}'),
  openParenthesis: kleur.dim('('),
  closeParenthesis: kleur.dim(')'),
  arrow: kleur.dim('=>'),
})
