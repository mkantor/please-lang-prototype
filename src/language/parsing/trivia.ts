import { parser } from '../../parsing.js'

const blockComment = parser.sequence([
  parser.literal('/*'),
  parser.zeroOrMore(
    parser.oneOf([
      parser.butNot(parser.anySingleCharacter, parser.literal('*'), '*'),
      parser.lookaheadNot(parser.literal('*'), parser.literal('/'), '/'),
    ]),
  ),
  parser.literal('*/'),
])

const singleLineComment = parser.sequence([
  parser.literal('//'),
  parser.zeroOrMore(
    parser.butNot(parser.anySingleCharacter, parser.literal('\n'), 'newline'),
  ),
])

export const whitespace = parser.regularExpression(/\s+/)

export const trivia = parser.oneOrMore(
  parser.oneOf([whitespace, singleLineComment, blockComment]),
)
