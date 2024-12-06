import { parser, type Parser } from '../../parsing.js'
import { optionallySurroundedByParentheses } from './parentheses.js'

export type Atom = string

export const isAtom = (value: unknown): value is Atom =>
  typeof value === 'string'

export const unit = '' as const

export const atomParser: Parser<Atom> = optionallySurroundedByParentheses(
  parser.map(
    parser.lazy(() => parser.oneOf([quotedAtom, unquotedAtom])),
    output => output.join(''),
  ),
)

const quotedAtom = parser.sequence([
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
])

const unquotedAtom = parser.oneOrMore(
  parser.regularExpression(/[^\s{}[\]()<>#&\|\\=:;,]+/),
)
