import type { Atom } from '../../parsing.js'

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

export type OpaqueType = {
  readonly name: string
  readonly kind: 'opaque'
  readonly isAssignableFrom: (possibleSubtype: Type) => boolean
  readonly isAssignableTo: (possibleSupertype: Type) => boolean
}

export const makeOpaqueType = (
  name: string,
  computations: {
    readonly isAssignableFrom: (source: Type) => boolean
    readonly isAssignableTo: (target: Type) => boolean
  },
): OpaqueType => ({
  name,
  kind: 'opaque',
  ...computations,
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

export type Type = FunctionType | ObjectType | OpaqueType | UnionType

export const matchTypeFormat = <Result>(
  type: Type,
  cases: {
    function: (type: FunctionType) => Result
    object: (type: ObjectType) => Result
    opaque: (type: OpaqueType) => Result
    union: (type: UnionType) => Result
  },
): Result => {
  switch (type.kind) {
    case 'function':
      return cases[type.kind](type)
    case 'object':
      return cases[type.kind](type)
    case 'opaque':
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
      object: ({ children }) => {
        const shownProperties: string[] = []
        for (const [key, value] of Object.entries(children)) {
          shownProperties.push(`${JSON.stringify(key)}: ${showType(value)}`)
        }
        return `{ ${shownProperties.join(', ')} }`
      },
      opaque: _ => '(unnameable type)',
      union: ({ members }) => {
        const [firstMember, ...otherMembers] = [...members]
        if (firstMember === undefined) {
          return 'nothing'
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
