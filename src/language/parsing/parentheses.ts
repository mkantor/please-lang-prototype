import {
  literal,
  map,
  oneOf,
  sequence,
  zeroOrMore,
  type Parser,
} from '@matt.kantor/parsing'
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
      literal('('),
      theParser,
      sequence([zeroOrMore(trivia), literal(')')]),
    ),
    optionallySurroundedBy(
      sequence([literal('('), zeroOrMore(trivia)]),
      theParser,
      sequence([zeroOrMore(trivia), literal(')')]),
    ),
  ])
