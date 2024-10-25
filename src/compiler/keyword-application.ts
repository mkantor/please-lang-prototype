import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import * as option from '../adts/option.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'
import type { InvalidSyntaxError, KeywordError } from './errors.js'
import type {
  CanonicalizedAtom,
  CanonicalizedMolecule,
  Molecule,
} from './index.js'
import {
  isKeyword,
  keywordTransforms,
  literalAtomToSemanticNode,
  literalMoleculeToSemanticNode,
  literalValueToSemanticNode,
  semanticNodeToMoleculeOrAtom,
  type AtomNode,
  type SemanticNode,
} from './keywords.js'
import { type Atom } from './parsing/atom.js'
import type { KeywordsApplied } from './stages.js'

export type CompiledValue = WithPhantomData<SemanticNode, KeywordsApplied>

export const applyKeywords = (
  value: CanonicalizedAtom | CanonicalizedMolecule,
): Either<KeywordError, CompiledValue> =>
  either.map(
    typeof value === 'string'
      ? handleAtomWhichMayNotBeAKeyword(value)
      : applyKeywordsWithinMolecule(value),
    withPhantomData<KeywordsApplied>(),
  )

const applyKeywordsWithinMolecule = (
  // `CanonicalizedMolecule`s aren't branded all the way down, so we need to operate on unbranded
  // `Molecule`s as we recurse.
  molecule: Molecule,
): Either<KeywordError, SemanticNode> => {
  let possibleKeywordCallAsMolecule: Writable<Molecule> = {}
  for (let [key, value] of Object.entries(molecule)) {
    const keyUpdateResult = handleAtomWhichMayNotBeAKeyword(key)
    if (either.isLeft(keyUpdateResult)) {
      // Immediately bail on error.
      return keyUpdateResult
    } else {
      const updatedKey = keyUpdateResult.value
      if (typeof value === 'string') {
        possibleKeywordCallAsMolecule[updatedKey.atom] = value
      } else {
        const result = applyKeywordsWithinMolecule(value)
        if (either.isLeft(result)) {
          // Immediately bail on error.
          return result
        }
        possibleKeywordCallAsMolecule[updatedKey.atom] =
          semanticNodeToMoleculeOrAtom(result.value)
      }
    }
  }

  const { 0: possibleKeyword, ...propertiesInNeedOfFinalization } =
    possibleKeywordCallAsMolecule

  // At this point `possibleKeywordCallAsMolecule` may still have unapplied escape sequences at the
  // top level (whether it is a keyword call or not).
  for (let [key, value] of Object.entries(propertiesInNeedOfFinalization)) {
    if (typeof value === 'string') {
      const valueUpdateResult = handleAtomWhichMayNotBeAKeyword(value)
      if (either.isLeft(valueUpdateResult)) {
        // Immediately bail on error.
        return valueUpdateResult
      } else {
        const updatedValue = valueUpdateResult.value
        possibleKeywordCallAsMolecule[key] =
          semanticNodeToMoleculeOrAtom(updatedValue)
      }
    }
  }

  if (typeof possibleKeywordCallAsMolecule['0'] === 'string') {
    return handleMoleculeWhichMayBeAKeywordCall({
      0: possibleKeywordCallAsMolecule['0'],
      ...possibleKeywordCallAsMolecule,
    })
  } else {
    // The input was actually just a literal object, not a keyword call.
    return either.makeRight(
      literalMoleculeToSemanticNode(possibleKeywordCallAsMolecule),
    )
  }
}

const handleMoleculeWhichMayBeAKeywordCall = ({
  0: possibleKeyword,
  ...possibleArguments
}: Molecule & { readonly 0: Atom }): Either<KeywordError, SemanticNode> =>
  option.match(option.fromPredicate(possibleKeyword, isKeyword), {
    none: () =>
      /^@[^@]/.test(possibleKeyword)
        ? either.makeLeft({
            kind: 'unknownKeyword',
            message: `unknown keyword: \`${possibleKeyword}\``,
          })
        : either.makeRight(
            literalValueToSemanticNode({
              ...possibleArguments,
              0: unescapeKeywordSigil(possibleKeyword),
            }),
          ),
    some: keyword =>
      keywordTransforms[keyword](
        literalMoleculeToSemanticNode(possibleArguments),
      ),
  })

const handleAtomWhichMayNotBeAKeyword = (
  atom: Atom,
): Either<InvalidSyntaxError, AtomNode> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntax',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(
      literalAtomToSemanticNode(unescapeKeywordSigil(atom)),
    )
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
