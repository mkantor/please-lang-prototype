import {
  type Parser,
  anySingleCharacter,
  as,
  butNot,
  lazy,
  literal,
  map,
  oneOf,
  oneOrMore,
  sequence,
  zeroOrMore,
} from '@matt.kantor/parsing'
import { optionallySurroundedByParentheses } from './parentheses.js'
import { whitespace } from './trivia.js'

export type Atom = string

export const isAtom = (value: unknown): value is Atom =>
  typeof value === 'string'

export const unit = '' as const

export const atomParser: Parser<Atom> = optionallySurroundedByParentheses(
  lazy(() => oneOf([quotedAtom, unquotedAtom])),
)

const quotedAtom = map(
  sequence([
    as(literal('"'), ''),
    map(
      zeroOrMore(
        oneOf([
          butNot(
            anySingleCharacter,
            oneOf([literal('"'), literal('\\')]),
            '`"` or `\\`',
          ),
          as(literal('\\"'), '"'),
          as(literal('\\\\'), '\\'),
        ]),
      ),
      output => output.join(''),
    ),
    as(literal('"'), ''),
  ]),
  ([_1, contents, _2]) => contents,
)

const unquotedAtom = map(
  oneOrMore(
    butNot(
      anySingleCharacter,
      oneOf([
        whitespace,
        literal('"'),
        literal('{'),
        literal('}'),
        literal('['),
        literal(']'),
        literal('('),
        literal(')'),
        literal('<'),
        literal('>'),
        literal('#'),
        literal('&'),
        literal('|'),
        literal('\\'),
        literal('='),
        literal(':'),
        literal(';'),
        literal(','),
        literal('//'),
        literal('/*'),
        literal('*/'),
      ]),
      'a forbidden character sequence',
    ),
  ),
  characters => characters.join(''),
)

export { unquotedAtom as unquotedAtomParser }
