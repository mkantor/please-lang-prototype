import either from '@matt.kantor/either'
import type { AlwaysSucceedingParser, Parser } from './parser.js'

export const anySingleCharacter: Parser<string> = input => {
  const firstCodePoint = input.codePointAt(0)
  if (firstCodePoint === undefined) {
    return either.makeLeft({
      input,
      message: 'input was empty',
    })
  } else {
    const firstCharacter = String.fromCodePoint(firstCodePoint)
    return either.makeRight({
      output: firstCharacter,
      remainingInput: input.slice(firstCharacter.length),
    })
  }
}

export const literal =
  (text: string): Parser<string> =>
  input =>
    input.startsWith(text)
      ? either.makeRight({
          remainingInput: input.slice(text.length),
          output: text,
        })
      : either.makeLeft({
          input,
          message: `input did not begin with \`${text}\``,
        })

export const nothing: AlwaysSucceedingParser<undefined> = input =>
  either.makeRight({
    remainingInput: input,
    output: undefined,
  })

export const regularExpression =
  (pattern: RegExp): Parser<string> =>
  input => {
    const match = pattern.exec(input)
    return match === null || match.index !== 0
      ? either.makeLeft({
          input,
          message: 'input did not match regular expression',
        })
      : either.makeRight({
          remainingInput: input.slice(match[0].length),
          output: match[0],
        })
  }
