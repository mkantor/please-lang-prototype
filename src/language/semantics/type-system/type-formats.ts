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
  readonly isAssignableFrom: (source: Type) => boolean
  readonly isAssignableTo: (target: Type) => boolean
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

export type TypeParameter = {
  readonly name: string
  readonly kind: 'parameter'
  readonly identity: symbol
  readonly constraint: {
    readonly assignableTo: Type
    // readonly assignableFrom: Type // TODO: implement lower bound constraints
  }
}

export const makeTypeParameter = (
  name: string,
  constraint: TypeParameter['constraint'],
): TypeParameter => ({
  name,
  kind: 'parameter',
  identity: Symbol(name),
  constraint,
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

export type Type =
  | FunctionType
  | ObjectType
  | OpaqueType
  | TypeParameter
  | UnionType

export const matchTypeFormat = <Result>(
  type: Type,
  cases: {
    function: (type: FunctionType) => Result
    object: (type: ObjectType) => Result
    opaque: (type: OpaqueType) => Result
    parameter: (type: TypeParameter) => Result
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
    case 'parameter':
      return cases[type.kind](type)
    case 'union':
      return cases[type.kind](type)
  }
}
