import type { Atom } from '../../parsing.js'
import * as types from './prelude-types.js'
import { isAssignable } from './subtyping.js'
import { matchTypeFormat, type Type } from './type-formats.js'

export const showType = (type: Type | Atom): string => {
  if (typeof type === 'string') {
    return JSON.stringify(type)
  } else {
    // Constraints are only shown the first time each type parameter is
    // mentioned.
    const mentionedTypeParameters: Set<symbol> = new Set()
    const showTypeImplementation = (type: Type): string => {
      if (type.name.trim() !== '' && type.kind !== 'parameter') {
        return type.name
      } else {
        return matchTypeFormat(type, {
          function: ({
            signature: { parameter: parameterType, return: returnType },
          }) =>
            `${showTypeImplementation(
              parameterType,
            )} => ${showTypeImplementation(returnType)}`,
          object: ({ children }) => {
            const shownProperties: string[] = []
            for (const [key, value] of Object.entries(children)) {
              shownProperties.push(`${key}: ${showTypeImplementation(value)}`)
            }
            return shownProperties.length === 0
              ? '{}'
              : `{ ${shownProperties.join(', ')} }`
          },
          opaque: _ => '(unnameable type)', // all opaque types should have a non-empty `name`
          parameter: ({ name, identity, constraint }) => {
            const nonEmptyName = name === '' ? 'a' : name
            if (mentionedTypeParameters.has(identity)) {
              return nonEmptyName
            } else {
              // This type parameter hasn't previously been mentioned, so
              // include its constraints. If the parameter's upper bound is the
              // top type then it's not really "constrained", so omit it.

              const shownUpperBound = isAssignable({
                source: types.something,
                target: constraint.assignableTo,
              })
                ? ''
                : ` <: ${showTypeImplementation(constraint.assignableTo)}`

              // Keep track so we don't mention this constraint again.
              mentionedTypeParameters.add(identity)

              if (shownUpperBound === '') {
                return nonEmptyName
              } else {
                return `(${nonEmptyName}${shownUpperBound})`
              }
            }
          },
          union: ({ members }) => {
            const [firstMember, ...otherMembers] = [...members]
            if (firstMember === undefined) {
              return types.nothing.name
            } else if (otherMembers.length === 0) {
              return typeof firstMember === 'string'
                ? JSON.stringify(firstMember)
                : showTypeImplementation(firstMember)
            } else {
              return `(${otherMembers.reduce<string>(
                (renderedUnion, currentValue) =>
                  `${renderedUnion} | ${
                    typeof currentValue === 'string'
                      ? JSON.stringify(currentValue)
                      : showTypeImplementation(currentValue)
                  }`,
                typeof firstMember === 'string'
                  ? JSON.stringify(firstMember)
                  : showTypeImplementation(firstMember),
              )})`
            }
          },
        })
      }
    }
    return showTypeImplementation(type)
  }
}
