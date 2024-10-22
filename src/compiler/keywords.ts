import type { Either } from '../adts/either.js'
import * as either from '../adts/either.js'
import { withPhantomData } from '../phantom-data.js'
import type { Atom } from './atom.js'
import type { KeywordError } from './errors.js'
import type { CompiledAtom, CompiledMolecule } from './keyword-application.js'
import type { Molecule } from './molecule.js'
import * as molecule from './molecule.js'
import type { KeywordsApplied } from './stages.js'

type KeywordTransform = (
  value: CompiledMolecule,
) => Either<KeywordError, CompiledAtom | CompiledMolecule>

export type Keyword = '@check' | '@todo'

/**
 * Checks whether a given value is assignable to a given type.
 */
const check = ({
  value,
  type,
}: {
  readonly value: Atom | Molecule
  readonly type: Atom | Molecule
}): ReturnType<KeywordTransform> => {
  if (value === type) {
    // This case is just an optimization. It allows skipping more expensive checks.
    return either.makeRight(withPhantomData<KeywordsApplied>()(value))
  } else if (typeof value === 'string' || typeof type === 'string') {
    // If either the value or the type are `string`s and aren't strictly-equal then we have a type
    // error. This also narrows `value` and `type` to objects for the next case.
    return either.makeLeft({
      kind: 'typeMismatch',
      message: `the value \`${JSON.stringify(
        value,
      )}\` is not assignable to the type \`${JSON.stringify(type)}\``,
    })
  } else {
    // Make sure all properties in the type are present and valid in the value (recursively).
    // Values may legally have additional properties beyond what is required by the type.
    for (const [key, typePropertyValue] of Object.entries(type)) {
      if (value[key] === undefined) {
        return either.makeLeft({
          kind: 'typeMismatch',
          message: `the value \`${JSON.stringify(
            value,
          )}\` is not assignable to the type \`${JSON.stringify(
            type,
          )}\` because it is missing the property \`${JSON.stringify(key)}\``,
        })
      } else {
        // Recursively check the property:
        const resultOfCheckingProperty = check({
          value: value[key],
          type: typePropertyValue,
        })
        if (either.isLeft(resultOfCheckingProperty)) {
          return resultOfCheckingProperty
        }
      }
    }
    // If this function has not yet returned then the value is assignable to the type.
    return either.makeRight(withPhantomData<KeywordsApplied>()(value))
  }
}

export const keywordTransforms: Record<Keyword, KeywordTransform> = {
  '@check': configuration => {
    const value = configuration.value ?? configuration['1']
    const type = configuration.type ?? configuration['2']

    if (value === undefined) {
      return either.makeLeft({
        kind: 'invalidKeywordArguments',
        message:
          'value must be provided via a property named `value` or the first positional argument',
      })
    } else if (type === undefined) {
      return either.makeLeft({
        kind: 'invalidKeywordArguments',
        message:
          'type must be provided via a property named `type` or the second positional argument',
      })
    } else {
      return check({ value, type })
    }
  },
  '@todo': _ =>
    either.makeRight(withPhantomData<KeywordsApplied>()(molecule.unit)),
}

// `isKeyword` is correct as long as `keywordTransforms` does not have excess properties.
const allKeywords = new Set(Object.keys(keywordTransforms))
export const isKeyword = (input: string): input is Keyword =>
  allKeywords.has(input)
