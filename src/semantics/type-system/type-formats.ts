import type { Atom } from '../../parsing.js'
import { nothing } from './prelude-types.js'

export type FunctionType = {
  readonly name: string
  readonly kind: 'function'
  readonly signature: {
    readonly parameter: Type
    readonly return: Type
  }
}

export const makeFunctionType = (
  name: string,
  signature: FunctionType['signature'],
): FunctionType => ({
  name,
  kind: 'function',
  signature,
})

export type LazyType = {
  readonly name: string
  readonly kind: 'lazy'
  readonly isAssignableFrom: (possibleSubtype: Type) => boolean
  readonly isAssignableTo: (possibleSupertype: Type) => boolean
}

export const makeLazyType = (
  name: string,
  computations: {
    readonly isAssignableFrom: (source: Type) => boolean
    readonly isAssignableTo: (target: Type) => boolean
  },
): LazyType => ({
  name,
  kind: 'lazy',
  ...computations,
})

export type ObjectType = {
  readonly name: string
  readonly kind: 'object'
  readonly children: {
    readonly [key: Atom]: Type
  }
}

export const makeObjectType = (
  name: string,
  children: {
    readonly [key: Atom]: Type
  },
): ObjectType => ({
  name,
  kind: 'object',
  children,
})

export type UnionType = {
  readonly name: string
  readonly kind: 'union'
  readonly members: ReadonlySet<
    Atom | Exclude<Type, UnionType> // unions are always flat
  >
}

export const makeUnionType = (
  name: string,
  members: readonly (Atom | Exclude<Type, UnionType>)[],
): UnionType => ({
  name,
  kind: 'union',
  members: new Set(members),
})

export type Type = FunctionType | LazyType | ObjectType | UnionType

export const matchTypeFormat = <Result>(
  type: Type,
  cases: {
    function: (type: FunctionType) => Result
    lazy: (type: LazyType) => Result
    object: (type: ObjectType) => Result
    union: (type: UnionType) => Result
  },
): Result => {
  switch (type.kind) {
    case 'function':
      return cases[type.kind](type)
    case 'lazy':
      return cases[type.kind](type)
    case 'object':
      return cases[type.kind](type)
    case 'union':
      return cases[type.kind](type)
  }
}

export const showType: (type: Type) => string = type => {
  if (type.name.trim() !== '') {
    return type.name
  } else {
    return matchTypeFormat(type, {
      function: ({ signature }) =>
        `${showType(signature.parameter)} => ${showType(signature.return)}`,
      lazy: _ => '(unnameable type)',
      object: ({ children }) => {
        const shownProperties: string[] = []
        for (const [key, value] of Object.entries(children)) {
          shownProperties.push(`${JSON.stringify(key)}: ${showType(value)}`)
        }
        return `{ ${shownProperties.join(', ')} }`
      },
      union: ({ members }) => {
        const [firstMember, ...otherMembers] = [...members]
        if (firstMember === undefined) {
          return nothing.name
        } else {
          return otherMembers.reduce<string>(
            (renderedUnion, currentValue) =>
              `${renderedUnion} | ${
                typeof currentValue === 'string'
                  ? JSON.stringify(currentValue)
                  : showType(currentValue)
              }`,
            typeof firstMember === 'string'
              ? JSON.stringify(firstMember)
              : showType(firstMember),
          )
        }
      },
    })
  }
}
