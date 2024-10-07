export type Atom = string

export const isAtom = (value: unknown): value is Atom =>
  typeof value === 'string'

export const unit = '' as const
