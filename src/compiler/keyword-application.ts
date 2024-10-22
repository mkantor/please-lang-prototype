import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import * as option from '../adts/option.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'
import { type Atom } from './atom.js'
import type { InvalidSyntaxError, KeywordError } from './errors.js'
import type {
  CanonicalizedAtom,
  CanonicalizedMolecule,
  Molecule,
} from './index.js'
import { isKeyword, keywordTransforms } from './keywords.js'
import type { KeywordsApplied } from './stages.js'

export type CompiledAtom = WithPhantomData<Atom, KeywordsApplied>
export type CompiledMolecule = WithPhantomData<Molecule, KeywordsApplied>

export const applyKeywords = (
  value: CanonicalizedAtom | CanonicalizedMolecule,
): Either<KeywordError, CompiledAtom | CompiledMolecule> =>
  typeof value === 'string'
    ? handleAtomWhichMayNotBeAKeyword(value)
    : applyKeywordsWithinMolecule(value)

const applyKeywordsWithinMolecule = (
  // `CanonicalizedMolecule`s aren't branded all the way down, so we need to operate on unbranded
  // `Molecule`s as we recurse.
  molecule: Molecule,
): Either<KeywordError, CompiledAtom | CompiledMolecule> => {
  let possibleKeywordCall: Writable<Molecule> = {}
  for (let [key, value] of Object.entries(molecule)) {
    const keyUpdateResult = handleAtomWhichMayNotBeAKeyword(key)
    if (either.isLeft(keyUpdateResult)) {
      // Immediately bail on error.
      return keyUpdateResult
    } else {
      const updatedKey = keyUpdateResult.value
      if (typeof value === 'string') {
        possibleKeywordCall[updatedKey] = value
      } else {
        const result = applyKeywordsWithinMolecule(value)
        if (either.isLeft(result)) {
          // Immediately bail on error.
          return result
        }
        possibleKeywordCall[updatedKey] = result.value
      }
    }
  }

  const { 0: possibleKeyword, ...propertiesInNeedOfFinalization } =
    possibleKeywordCall

  // At this point `possibleKeywordCall` may still have unapplied escape sequences at the top level
  // (whether it is a keyword call or not).
  for (let [key, value] of Object.entries(propertiesInNeedOfFinalization)) {
    if (typeof value === 'string') {
      const valueUpdateResult = handleAtomWhichMayNotBeAKeyword(value)
      if (either.isLeft(valueUpdateResult)) {
        // Immediately bail on error.
        return valueUpdateResult
      } else {
        const updatedValue: CompiledAtom = valueUpdateResult.value
        possibleKeywordCall[key] = updatedValue
      }
    }
  }

  if (typeof possibleKeywordCall['0'] === 'string') {
    return handleMoleculeWhichMayBeAKeywordCall(
      withPhantomData<KeywordsApplied>()({
        0: possibleKeywordCall['0'],
        ...possibleKeywordCall,
      }),
    )
  } else {
    return either.makeRight(
      withPhantomData<KeywordsApplied>()(possibleKeywordCall),
    )
  }
}

const handleMoleculeWhichMayBeAKeywordCall = ({
  0: possibleKeyword,
  ...possibleArguments
}: CompiledMolecule & {
  readonly 0: Atom
}): Either<KeywordError, CompiledAtom | CompiledMolecule> =>
  option.match(option.fromPredicate(possibleKeyword, isKeyword), {
    none: () =>
      /^@[^@]/.test(possibleKeyword)
        ? either.makeLeft({
            kind: 'unknownKeyword',
            message: `unknown keyword: \`${possibleKeyword}\``,
          })
        : either.makeRight(
            withPhantomData<KeywordsApplied>()({
              ...possibleArguments,
              0: unescapeKeywordSigil(possibleKeyword),
            }),
          ),
    some: keyword => keywordTransforms[keyword](possibleArguments),
  })

const handleAtomWhichMayNotBeAKeyword = (
  atom: Atom,
): Either<InvalidSyntaxError, CompiledAtom> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntax',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(
      withPhantomData<KeywordsApplied>()(unescapeKeywordSigil(atom)),
    )
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
