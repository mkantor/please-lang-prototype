import { type Expression } from '../expression.js'

export type TodoExpression = Expression & {
  readonly 0: '@todo'
}
