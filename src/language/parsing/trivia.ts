import {
  anySingleCharacter,
  butNot,
  lookaheadNot,
  oneOf,
  oneOrMore,
  regularExpression,
  sequence,
  zeroOrMore,
} from '@matt.kantor/parsing'
import {
  asterisk,
  closingBlockCommentDelimiter,
  newline,
  openingBlockCommentDelimiter,
  singleLineCommentDelimiter,
  slash,
} from './literals.js'

const blockComment = sequence([
  openingBlockCommentDelimiter,
  zeroOrMore(
    oneOf([
      butNot(anySingleCharacter, asterisk, '*'),
      lookaheadNot(asterisk, slash, '/'),
    ]),
  ),
  closingBlockCommentDelimiter,
])

const singleLineComment = sequence([
  singleLineCommentDelimiter,
  zeroOrMore(butNot(anySingleCharacter, newline, 'newline')),
])

export const whitespace = regularExpression(/^\s+/)

export const trivia = oneOrMore(
  oneOf([whitespace, singleLineComment, blockComment]),
)
