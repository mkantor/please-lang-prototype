export type JsonArray = readonly JsonValue[]
export type JsonRecord = { readonly [key: string]: JsonValue }
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonArray
  | JsonRecord

export type Writable<T> = { -readonly [P in keyof T]: T[P] }
