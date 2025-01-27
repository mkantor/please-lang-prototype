import {
  anySingleCharacter,
  butNot,
  literal,
  lookaheadNot,
  oneOf,
  oneOrMore,
  regularExpression,
  sequence,
  zeroOrMore,
} from '@matt.kantor/parsing'

const blockComment = sequence([
  literal('/*'),
  zeroOrMore(
    oneOf([
      butNot(anySingleCharacter, literal('*'), '*'),
      lookaheadNot(literal('*'), literal('/'), '/'),
    ]),
  ),
  literal('*/'),
])

const singleLineComment = sequence([
  literal('//'),
  zeroOrMore(butNot(anySingleCharacter, literal('\n'), 'newline')),
])

export const whitespace = regularExpression(/\s+/)

export const trivia = oneOrMore(
  oneOf([whitespace, singleLineComment, blockComment]),
)
