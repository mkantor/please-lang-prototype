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
  zeroOrMore,
} from '@matt.kantor/parsing'
import {
  backslash,
  closingBlockCommentDelimiter,
  closingBrace,
  closingParenthesis,
  colon,
  comma,
  escapedBackslash,
  escapedQuote,
  openingBlockCommentDelimiter,
  openingBrace,
  openingParenthesis,
  quote,
  singleLineCommentDelimiter,
} from './literals.js'
import { optionallySurroundedByParentheses } from './parentheses.js'
import { whitespace } from './trivia.js'

export type Atom = string

const atomComponentsRequiringQuotation = [
  backslash,
  closingBlockCommentDelimiter,
  closingBrace,
  closingParenthesis,
  colon,
  comma,
  openingBlockCommentDelimiter,
  openingBrace,
  openingParenthesis,
  quote,
  singleLineCommentDelimiter,
  whitespace,

  // Reserved for future use:
  literal('['),
  literal(']'),
  literal('<'),
  literal('>'),
  literal('#'),
  literal('&'),
  literal('|'),
  literal('='),
  literal(';'),
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
    quote,
    map(
      zeroOrMore(
        oneOf([
          // `"` and `\` need to be escaped
          butNot(anySingleCharacter, oneOf([quote, backslash]), '`"` or `\\`'),
          as(escapedQuote, '"'),
          as(escapedBackslash, '\\'),
        ]),
      ),
      output => output.join(''),
    ),
    quote,
  ]),
  ([_1, contents, _2]) => contents,
)

export const atomParser: Parser<Atom> = optionallySurroundedByParentheses(
  oneOf([unquotedAtomParser, quotedAtomParser]),
)
