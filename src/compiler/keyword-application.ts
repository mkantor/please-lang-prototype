import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import type { Option } from '../adts/option.js'
import * as option from '../adts/option.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Atom } from './atom.js'
import * as atom from './atom.js'
import type { KeywordError } from './errors.js'
import { keywordPrefixOf, keywordTransforms } from './keywords.js'
import type { Molecule, UncompiledMolecule } from './molecule.js'
import type { KeywordsApplied } from './stages.js'

export type CompiledAtom = WithPhantomData<Atom, KeywordsApplied>
export type CompiledMolecule = WithPhantomData<Molecule, KeywordsApplied>

export const applyKeywords = (
  molecule: UncompiledMolecule,
): Either<KeywordError, Option<CompiledMolecule>> =>
  transformMolecule(molecule, (key, value) =>
    // Eliminated values become the unit value; eliminated keys omit the whole property.
    either.flatMap(applyValueKeywords(value), potentiallyEliminatedValue =>
      option.match(potentiallyEliminatedValue, {
        none: () =>
          applyKeyKeywords(key, withPhantomData<KeywordsApplied>()(atom.unit)),
        some: value => applyKeyKeywords(key, value),
      }),
    ),
  )

const applyKeyKeywords = (
  key: Atom,
  valueWithKeywordsApplied: CompiledAtom | CompiledMolecule,
): Either<
  KeywordError,
  Option<readonly [key: CompiledAtom, value: CompiledAtom | CompiledMolecule]>
> =>
  option.match(keywordPrefixOf(key), {
    none: () =>
      /^@[^@]/.test(key)
        ? either.makeLeft({
            kind: 'unknownKeyword',
            message: `unknown keyword in key: \`${key}\``,
          })
        : either.makeRight(
            option.makeSome([
              withPhantomData<KeywordsApplied>()(
                /^@@/.test(key) ? key.substring(1) : key,
              ),
              withPhantomData<KeywordsApplied>()(valueWithKeywordsApplied),
            ]),
          ),
    some: keyword =>
      keywordTransforms[keyword].key(key, valueWithKeywordsApplied),
  })

const applyValueKeywords = (
  value: Atom | UncompiledMolecule,
): Either<KeywordError, Option<CompiledAtom | CompiledMolecule>> => {
  switch (typeof value) {
    case 'string':
      return option.match(keywordPrefixOf(value), {
        none: () =>
          /^@[^@]/.test(value)
            ? either.makeLeft({
                kind: 'unknownKeyword',
                message: `unknown keyword in value: \`${value}\``,
              })
            : either.makeRight(
                option.makeSome(
                  withPhantomData<KeywordsApplied>()(
                    /^@@/.test(value) ? value.substring(1) : value,
                  ),
                ),
              ),
        some: keyword => keywordTransforms[keyword].value(value),
      })
    case 'object':
      // Recurse into the nested molecule.
      return applyKeywords(value)
  }
}

/**
 * Given a callback returning a new key/value pair, incrementally build up a result by recursively
 * walking over every key/value pair within the given `Molecule`.
 */
const transformMolecule = <Error>(
  molecule: UncompiledMolecule,
  f: (
    key: Atom,
    value: Atom | UncompiledMolecule,
  ) => Either<
    Error,
    Option<readonly [key: CompiledAtom, value: CompiledAtom | CompiledMolecule]>
  >,
): Either<Error, Option<CompiledMolecule>> => {
  const updatedMolecule: CompiledMolecule = withPhantomData<KeywordsApplied>()(
    {},
  )
  for (let [key, value] of Object.entries(molecule)) {
    const result = f(key, value)
    if (either.isLeft(result)) {
      // Immediately bail if an error is encountered.
      return result
    }
    option.match(result.value, {
      none: () => {},
      some: ([newKey, newValue]) => {
        updatedMolecule[newKey] = newValue
      },
    })
  }
  return either.makeRight(option.makeSome(updatedMolecule))
}
