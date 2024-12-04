import { parser, type Parser } from '../../parsing.js'

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
  optionallySurroundedBy(parser.literal('('), theParser, parser.literal(')'))
