import type { Either } from '../../adts/either.js'
import * as either from '../../adts/either.js'
import type { Writable } from '../../utility-types.js'
import type { KeywordError } from '../errors.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'

const nodeTag = Symbol('nodeTag')

export type AtomNode = {
  readonly [nodeTag]: 'atom'
  readonly atom: Atom
}
export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly children: Readonly<Record<Atom, SemanticNode>>
}

export type SemanticNode = AtomNode | ObjectNode

type KeywordTransform = (call: ObjectNode) => Either<KeywordError, SemanticNode>

export const literalValueToSemanticNode = (
  value: Atom | Molecule,
): SemanticNode =>
  typeof value === 'string'
    ? literalAtomToSemanticNode(value)
    : literalMoleculeToSemanticNode(value)

export const literalAtomToSemanticNode = (atom: Atom): AtomNode => ({
  [nodeTag]: 'atom',
  atom,
})

export const literalMoleculeToSemanticNode = (
  molecule: Molecule,
): ObjectNode => {
  const children: Writable<ObjectNode['children']> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    children[key] = literalValueToSemanticNode(propertyValue)
  }
  return {
    [nodeTag]: 'object',
    children,
  }
}

export const semanticNodeToMoleculeOrAtom = (
  node: SemanticNode,
): Atom | Molecule =>
  node[nodeTag] === 'atom' ? node.atom : objectNodeToMolecule(node)

const objectNodeToMolecule = (node: ObjectNode): Molecule => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node.children)) {
    molecule[key] = semanticNodeToMoleculeOrAtom(propertyValue)
  }
  return molecule
}

const handlers = {
  /**
   * Checks whether a given value is assignable to a given type.
   */
  check: ({
    value,
    type,
  }: {
    readonly value: SemanticNode
    readonly type: SemanticNode
  }): ReturnType<KeywordTransform> => {
    if (value[nodeTag] === 'atom' || type[nodeTag] === 'atom') {
      return value[nodeTag] === 'atom' &&
        type[nodeTag] === 'atom' &&
        value.atom === type.atom
        ? either.makeRight(value)
        : either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${JSON.stringify(
              value,
            )}\` is not assignable to the type \`${JSON.stringify(type)}\``,
          })
    } else {
      // Make sure all properties in the type are present and valid in the value (recursively).
      // Values may legally have additional properties beyond what is required by the type.
      for (const [key, typePropertyValue] of Object.entries(type.children)) {
        if (value.children[key] === undefined) {
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
          const resultOfCheckingProperty = handlers.check({
            value: value.children[key],
            type: typePropertyValue,
          })
          if (either.isLeft(resultOfCheckingProperty)) {
            return resultOfCheckingProperty
          }
        }
      }
      // If this function has not yet returned then the value is assignable to the type.
      return either.makeRight(value)
    }
  },

  /**
   * Ignores all arguments and evaluates to an empty molecule.
   */
  todo: (): ReturnType<KeywordTransform> =>
    either.makeRight({ [nodeTag]: 'object', children: {} }),
}

export const keywordTransforms = {
  '@check': configuration => {
    const value = configuration.children.value ?? configuration.children['1']
    const type = configuration.children.type ?? configuration.children['2']
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
      return handlers.check({ value, type })
    }
  },
  '@todo': handlers.todo,
} satisfies Record<`@${string}`, KeywordTransform>

export type Keyword = keyof typeof keywordTransforms

// `isKeyword` is correct as long as `keywordTransforms` does not have excess properties.
const allKeywords = new Set(Object.keys(keywordTransforms))
export const isKeyword = (input: unknown): input is Keyword =>
  typeof input === 'string' && allKeywords.has(input)
