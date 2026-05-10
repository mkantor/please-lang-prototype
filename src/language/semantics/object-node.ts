import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import * as orderedRecord from '../../ordered-record.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { asSemanticGraph } from './expressions/expression-utilities.js'
import { serializeFunctionNode } from './function-node.js'
import { nodeTag } from './semantic-graph-node-tag.js'
import { serialize, type Output, type SemanticGraph } from './semantic-graph.js'

/**
 * Key for a sidecar property on every `ObjectNode` which records semantic
 * ordering of properties (source order). Iteration sites that care about order
 * (serialization, unparsing, elaboration) consult this rather than relying on
 * `Object.keys`/`Object.entries`, which sort integer-like keys ahead of
 * string-like keys [as per the ECMAScript specification][1].
 *
 * [1]: https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryownpropertykeys
 */
// TODO: Consider ditching this and instead backing `ObjectNode` with an
// `OrderedRecord` (this would be an invasive change as it'd eliminate direct
// `node[key]` access and make it impossible to subtype `ObjectNode` with
// specific properties (e.g. for `Expression`)).
export const orderedKeys = Symbol('orderedKeys')

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly [orderedKeys]: readonly Atom[]
  readonly [key: Atom]: SemanticGraph
}

export const isObjectNode = (node: SemanticGraph) =>
  typeof node === 'object' && node[nodeTag] === 'object'

export const orderedEntriesOfObjectNode = (
  node: ObjectNode,
): readonly (readonly [Atom, SemanticGraph])[] =>
  node[orderedKeys].map(key => {
    const value = node[key]
    if (value === undefined) {
      throw new Error(
        `ObjectNode declared key \`${key}\` in its orderedKeys sidecar but the property is missing. This is a bug!`,
      )
    }
    return [key, value]
  })

export const lookupPropertyOfObjectNode = (
  key: Atom,
  node: ObjectNode,
): Option<SemanticGraph> =>
  key in node && node[key] !== undefined ?
    option.makeSome(node[key])
  : option.none

type PropertyValueToSemanticGraph<
  PropertyValue extends SemanticGraph | Molecule,
> =
  PropertyValue extends SemanticGraph ? PropertyValue
  : PropertyValue extends Molecule ? ObjectNode
  : never

type PropertiesToSemanticGraphs<
  Properties extends Readonly<Record<Atom, SemanticGraph | Molecule>>,
> = {
  [K in keyof Properties]: PropertyValueToSemanticGraph<Properties[K]>
}

/**
 * @deprecated Does not preserve property order; prefer `objectNodeFromMolecule`
 * or `objectNodeFromOrderedEntries`.
 */
export const makeObjectNode = <
  const Properties extends Readonly<Record<Atom, SemanticGraph | Molecule>>,
>(
  properties: Properties,
): ObjectNode & PropertiesToSemanticGraphs<Properties> => {
  const propertiesAsSemanticGraphs = Object.fromEntries(
    Object.entries(properties).map(
      ([key, value]) => [key, asSemanticGraph(value)] as const,
    ),
  ) satisfies Record<
    Atom,
    SemanticGraph
  > as PropertiesToSemanticGraphs<Properties> // This type assertion assumes no excess properties are present.

  return {
    ...propertiesAsSemanticGraphs,
    [nodeTag]: 'object',
    [orderedKeys]: Object.keys(propertiesAsSemanticGraphs),
  }
}

/**
 * Construct an `ObjectNode` from an iterable of `[key, value]` pairs. Order
 * is preserved in the resulting node's `orderedKeys` sidecar.
 */
export const objectNodeFromOrderedEntries = (
  entries: Iterable<readonly [Atom, SemanticGraph]>,
): ObjectNode => ({
  ...Object.fromEntries(entries),
  [nodeTag]: 'object',
  [orderedKeys]: [...entries].map(([key, _value]) => key),
})

/**
 * Convert an `OrderedRecord`-backed `Molecule` to an `ObjectNode`, preserving
 * the molecule's source order via `orderedKeys`. Property values that are
 * themselves `Molecule`s are converted recursively.
 */
export const objectNodeFromMolecule = (molecule: Molecule): ObjectNode =>
  objectNodeFromOrderedEntries(
    orderedRecord.mapValues(molecule, asSemanticGraph).entries,
  )

/**
 * Return a new `ObjectNode` with `key` mapped to `value`. If `key` already
 * exists, its position in `orderedKeys` is preserved; if new, it is appended.
 */
export const withProperty = <Key extends Atom, Value extends SemanticGraph>(
  node: ObjectNode,
  key: Key,
  value: Value,
): ObjectNode & Record<Key, Value> =>
  ({
    ...node,
    [orderedKeys]:
      key in node ? node[orderedKeys] : [...node[orderedKeys], key],
    [key satisfies Key]: value satisfies Value,
  }) satisfies ObjectNode as ObjectNode & Record<Key, Value>

export const serializeObjectNode = (
  node: ObjectNode,
): Either<UnserializableValueError, Molecule> =>
  either.map(
    either.sequence(
      orderedEntriesOfObjectNode(node).map(([key, propertyValue]) =>
        either.map(
          serializeObjectPropertyValue(propertyValue),
          serializedValue => [key, serializedValue] as const,
        ),
      ),
    ),
    orderedRecord.make,
  )

const serializeObjectPropertyValue = (
  propertyValue: ObjectNode[string],
): Either<UnserializableValueError, Output> => {
  switch (typeof propertyValue) {
    case 'string':
    case 'symbol':
      return serialize(propertyValue)
    case 'object':
      return serialize(makeObjectNode(propertyValue))
    case 'function':
      return serializeFunctionNode(propertyValue)
  }
}
