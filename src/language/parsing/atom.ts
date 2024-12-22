import { parser, type Parser } from '../../parsing.js'
import { optionallySurroundedByParentheses } from './parentheses.js'
import { whitespace } from './trivia.js'

export type Atom = string

export const isAtom = (value: unknown): value is Atom =>
  typeof value === 'string'

export const unit = '' as const

export const atomParser: Parser<Atom> = optionallySurroundedByParentheses(
  parser.lazy(() => parser.oneOf([quotedAtom, unquotedAtom])),
)

const quotedAtom = parser.map(
  parser.sequence([
    parser.as(parser.literal('"'), ''),
    parser.map(
      parser.zeroOrMore(
        parser.oneOf([
          parser.butNot(
            parser.anySingleCharacter,
            parser.oneOf([parser.literal('"'), parser.literal('\\')]),
            '`"` or `\\`',
          ),
          parser.as(parser.literal('\\"'), '"'),
          parser.as(parser.literal('\\\\'), '\\'),
        ]),
      ),
      output => output.join(''),
    ),
    parser.as(parser.literal('"'), ''),
  ]),
  ([_1, contents, _2]) => contents,
)

const unquotedAtom = parser.map(
  parser.oneOrMore(
    parser.butNot(
      parser.anySingleCharacter,
      parser.oneOf([
        whitespace,
        parser.literal('"'),
        parser.literal('{'),
        parser.literal('}'),
        parser.literal('['),
        parser.literal(']'),
        parser.literal('('),
        parser.literal(')'),
        parser.literal('<'),
        parser.literal('>'),
        parser.literal('#'),
        parser.literal('&'),
        parser.literal('|'),
        parser.literal('\\'),
        parser.literal('='),
        parser.literal(':'),
        parser.literal(';'),
        parser.literal(','),
        parser.literal('//'),
        parser.literal('/*'),
        parser.literal('*/'),
      ]),
      'a forbidden character sequence',
    ),
  ),
  characters => characters.join(''),
)

export { unquotedAtom as unquotedAtomParser }
