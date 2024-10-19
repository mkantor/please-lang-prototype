import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import type { KeywordError } from './errors.js'
import type { CompiledAtom, CompiledMolecule } from './keyword-application.js'

type KeywordTransform = (
  value: CompiledMolecule,
) => Either<KeywordError, Option<CompiledAtom | CompiledMolecule>>

export type Keyword = 'todo'

export const keywordTransforms: Record<Keyword, KeywordTransform> = {
  todo: _ => either.makeRight(option.none),
}

const keywordPattern = new RegExp(
  `^@(${Object.keys(keywordTransforms).join('|')})`,
)
export const keywordPrefixOf = (input: string): Option<Keyword> => {
  const possibleKeyword = keywordPattern.exec(input)?.[1]
  return possibleKeyword === undefined
    ? option.none
    : option.makeSome(possibleKeyword as Keyword)
}
