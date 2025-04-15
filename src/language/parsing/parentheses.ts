import {
  map,
  oneOf,
  sequence,
  zeroOrMore,
  type Parser,
} from '@matt.kantor/parsing'
import { closingParenthesis, openingParenthesis } from './literals.js'
import { trivia } from './trivia.js'

const optionallySurroundedBy = <Output>(
  parser1: Parser<unknown>,
  theParser: Parser<Output>,
  parser2: Parser<unknown>,
): Parser<Output> =>
  oneOf([
    theParser,
    map(sequence([parser1, theParser, parser2]), ([_1, output, _2]) => output),
  ])

export const optionallySurroundedByParentheses = <Output>(
  theParser: Parser<Output>,
): Parser<Output> =>
  oneOf([
    // This allows `theParser` to greedily consume trivia.
    optionallySurroundedBy(
      openingParenthesis,
      theParser,
      sequence([zeroOrMore(trivia), closingParenthesis]),
    ),
    optionallySurroundedBy(
      sequence([openingParenthesis, zeroOrMore(trivia)]),
      theParser,
      sequence([zeroOrMore(trivia), closingParenthesis]),
    ),
  ])
