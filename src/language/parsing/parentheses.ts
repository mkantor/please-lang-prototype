import { parser, type Parser } from '../../parsing.js'
import { trivia } from './trivia.js'

const optionallySurroundedBy = <Output>(
  parser1: Parser<unknown>,
  theParser: Parser<Output>,
  parser2: Parser<unknown>,
): Parser<Output> =>
  parser.oneOf([
    theParser,
    parser.map(
      parser.sequence([parser1, theParser, parser2]),
      ([_1, output, _2]) => output,
    ),
  ])

export const optionallySurroundedByParentheses = <Output>(
  theParser: Parser<Output>,
): Parser<Output> =>
  parser.oneOf([
    // This allows `theParser` to greedily consume trivia.
    optionallySurroundedBy(
      parser.literal('('),
      theParser,
      parser.sequence([parser.zeroOrMore(trivia), parser.literal(')')]),
    ),
    optionallySurroundedBy(
      parser.sequence([parser.literal('('), parser.zeroOrMore(trivia)]),
      theParser,
      parser.sequence([parser.zeroOrMore(trivia), parser.literal(')')]),
    ),
  ])
