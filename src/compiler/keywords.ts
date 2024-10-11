import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import type { Atom } from './atom.js'
import type { KeywordError } from './errors.js'
import type { CompiledAtom, CompiledMolecule } from './keyword-application.js'
import type { UncompiledMolecule } from './molecule.js'

type KeywordTransforms = {
  readonly key: (
    key: Atom,
    valueWithKeywordsApplied: CompiledAtom | CompiledMolecule,
  ) => Either<
    KeywordError,
    Option<readonly [key: CompiledAtom, value: CompiledAtom | CompiledMolecule]>
  >
  readonly value: (
    value: Atom | UncompiledMolecule,
  ) => Either<KeywordError, Option<CompiledAtom | CompiledMolecule>>
}

// Note that because of the very simple parsing scheme no keyword may be a prefix of another
// keyword. For example if `in` is a keyword, then `infer` cannot also be a keyword.
export type Keyword = 'todo'

export const keywordTransforms: Record<Keyword, KeywordTransforms> = {
  todo: {
    key: _ => either.makeRight(option.none),
    value: _ => either.makeRight(option.none),
  },
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
