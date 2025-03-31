import {
  type Parser,
  anySingleCharacter,
  as,
  butNot,
  literal,
  map,
  oneOf,
  oneOrMore,
  sequence,
  zeroOrMore
} from '@matt.kantor/parsing'
import { optionallySurroundedByParentheses } from './parentheses.js'
import { whitespace } from './trivia.js'

export type Atom = string

const atomComponentsRequiringQuotation = [
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
] as const


export const atomWithAdditionalQuotationRequirements = (
  additionalQuoteRequiringComponent: Parser<unknown>,
) =>
  optionallySurroundedByParentheses(
    oneOf([
      map(
        oneOrMore(
          butNot(
            anySingleCharacter,
            oneOf([
              ...atomComponentsRequiringQuotation,
              additionalQuoteRequiringComponent,
            ]),
            'a character sequence requiring quotation',
          ),
        ),
        characters => characters.join(''),
      ),
      quotedAtomParser,
    ]),
  )

export const unquotedAtomParser = map(
  oneOrMore(
    butNot(
      anySingleCharacter,
      oneOf(atomComponentsRequiringQuotation),
      'a character sequence requiring quotation',
    ),
  ),
  characters => characters.join(''),
)

const quotedAtomParser = map(
  sequence([
    literal('"'),
    map(
      zeroOrMore(
        oneOf([
          // `"` and `\` need to be escaped
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
    literal('"'),
  ]),
  ([_1, contents, _2]) => contents,
)

export const atomParser: Parser<Atom> = optionallySurroundedByParentheses(
  oneOf([unquotedAtomParser, quotedAtomParser]),
)
