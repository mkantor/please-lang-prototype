import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import * as option from '../adts/option.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'
import { type Atom } from './atom.js'
import type { KeywordError } from './errors.js'
import type { CanonicalizedMolecule, Molecule } from './index.js'
import { keywordPrefixOf, keywordTransforms } from './keywords.js'
import type { KeywordsApplied } from './stages.js'

export type CompiledAtom = WithPhantomData<Atom, KeywordsApplied>
export type CompiledMolecule = WithPhantomData<Molecule, KeywordsApplied>

export const applyKeywords = (
  molecule: CanonicalizedMolecule,
): Either<KeywordError, CompiledAtom | CompiledMolecule> =>
  applyKeywordsImplementation(molecule)

const applyKeywordsImplementation = (
  // `CanonicalizedMolecule`s aren't branded all the way down, so we need to operate on unbranded
  // `Molecule`s as we recurse. This is the only difference from `applyKeywords`'s public signature.
  molecule: Molecule,
): Either<KeywordError, CompiledAtom | CompiledMolecule> => {
  const updatedMolecule: Writable<CompiledMolecule> =
    withPhantomData<KeywordsApplied>()({})
  for (let [key, value] of Object.entries(molecule)) {
    if (typeof value === 'string') {
      updatedMolecule[key] = value
    } else {
      const result = applyKeywordsImplementation(value)
      if (either.isLeft(result)) {
        // Immediately bail if an error is encountered.
        return result
      }
      updatedMolecule[key] = result.value
    }
  }

  const possibleKeyword = updatedMolecule['0']
  if (typeof possibleKeyword === 'string') {
    return option.match(keywordPrefixOf(possibleKeyword), {
      none: () => {
        if (/^@[^@]/.test(possibleKeyword)) {
          return either.makeLeft({
            kind: 'unknownKeyword',
            message: `unknown keyword: \`${possibleKeyword}\``,
          })
        } else {
          return either.makeRight(
            withPhantomData<KeywordsApplied>()(
              /^@@/.test(possibleKeyword)
                ? { ...updatedMolecule, 0: possibleKeyword.substring(1) } // handle escape sequence
                : updatedMolecule,
            ),
          )
        }
      },
      some: keyword =>
        either.map(
          keywordTransforms[keyword](updatedMolecule),
          transformOutput =>
            option.match(transformOutput, {
              none: () => withPhantomData<KeywordsApplied>()({}),
              some: x => x,
            }),
        ),
    })
  } else {
    return either.makeRight(updatedMolecule)
  }
}
