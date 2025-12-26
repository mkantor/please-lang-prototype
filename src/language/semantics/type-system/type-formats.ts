import type { None, Some } from '@matt.kantor/option'
import option from '@matt.kantor/option'
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
  readonly symbol: symbol
  readonly kind: 'opaque'
  readonly isAssignableFrom: (source: Type) => boolean
  readonly isAssignableTo: (target: Type) => boolean
}

// TODO: Opaque object/function types?
export const makeOpaqueAtomType = (
  name: string,
  subtyping: {
    readonly isAssignableFromLiteralType: (literalType: string) => boolean
  } & (
    | {
        readonly nearestOpaqueAssignableFrom: () => None
        readonly nearestOpaqueAssignableTo: () => Some<OpaqueType>
      }
    | {
        readonly nearestOpaqueAssignableFrom: () => Some<OpaqueType>
        readonly nearestOpaqueAssignableTo: () => None
      }
    | {
        readonly nearestOpaqueAssignableFrom: () => Some<OpaqueType>
        readonly nearestOpaqueAssignableTo: () => Some<OpaqueType>
      }
  ),
): OpaqueType => {
  const self: OpaqueType = {
    name,
    symbol: Symbol(name),
    kind: 'opaque',
    isAssignableFrom: source =>
      matchTypeFormat(source, {
        function: _ => false,
        object: _ => false,
        opaque: source =>
          source === self ||
          option.match(subtyping.nearestOpaqueAssignableFrom(), {
            none: () => false,
            some: nearestOpaqueAssignableFrom =>
              nearestOpaqueAssignableFrom.isAssignableFrom(source),
          }),
        parameter: source =>
          self.isAssignableFrom(source.constraint.assignableTo),
        union: source => {
          for (const sourceMember of source.members) {
            if (typeof sourceMember === 'string') {
              if (!subtyping.isAssignableFromLiteralType(sourceMember)) {
                return false
              }
            } else if (!self.isAssignableFrom(sourceMember)) {
              return false
            }
          }
          return true
        },
      }),
    isAssignableTo: target =>
      matchTypeFormat(target, {
        function: _ => false,
        object: _ => false,
        opaque: target =>
          target === self ||
          option.match(subtyping.nearestOpaqueAssignableTo(), {
            none: () => false,
            some: nearestOpaqueAssignableTo =>
              nearestOpaqueAssignableTo.isAssignableTo(target),
          }),
        parameter: _ => false,
        union: target => {
          for (const targetMember of target.members) {
            if (
              // Opaque types are never assignable to literal types.
              typeof targetMember !== 'string' &&
              self.isAssignableTo(targetMember)
            ) {
              return true
            }
          }
          return false
        },
      }),
  }
  return self
}

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

type SpecificUnionType<Member extends Atom | Exclude<Type, UnionType>> =
  UnionType & {
    readonly members: ReadonlySet<Member>
  }

export const makeUnionType = <Member extends Atom | Exclude<Type, UnionType>>(
  name: string,
  members: readonly Member[],
): SpecificUnionType<Member> => ({
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
