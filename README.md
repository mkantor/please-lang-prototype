# Please

An exploratory programming language.

## Quick Start

```sh
git clone git@github.com:mkantor/please-lang-prototype.git
cd please-lang-prototype
npm install
npm run build
echo '{@runtime context => :context.program.start_time}' | ./please --output-format=json
```

## What This Repository Is

**This implementation of Please is a proof of concept**. There are bugs and
missing pieces, and language syntax/semantics may change backwards-incompatibly
on the way to an official release. TypeScript was chosen because it's pretty
good for rapid prototyping, but different languages may be used in non-prototype
implementations.

### Current State

Enough pieces exist to write basic runnable programs. There is a type system,
but it's not wired up in many places yet so mistakes often go unnoticed at
compile time. The standard library is anemic and documentation is lacking.

The current runtime is an interpreter, but the plan is to eventually add one or
more backends to allow building native executables.

### What's Next?

I'm focused on squashing compiler bugs and establishing solid foundations to
build atop. Along the way I've been slowly fleshing out the type system and
standard library.

## Language Design

### Syntax

A Please program is composed of atoms, objects, lookups, and functions.

#### Atoms

Atoms are the raw textual portions of your source code. They're similar to
strings from other programming languages, except there isn't a specific runtime
data representation implied by the fact that a value is an atom (e.g. the atom
`2` may be an integer in memory).

Bare words not containing any
[reserved character sequences](./src/language/parsing/atom.ts#L19-L41) are
atoms:

```
Hello
```

Atoms can be quoted:

```
"Hello, World!"
```

#### Objects

Objects are maps of key/value pairs ("properties"), where keys must be atoms:

```
{ greeting: "Hello, World!" }
```

Object properties without explicitly-written keys are automatically enumerated:

```
{ Hello World } // is the same as { 0: Hello, 1: World }
```

#### Lookups

Data can be referenced from other places in the program using lookups, like
`:en` below:

```
{
  en: "Hello, World!"
  zh: "世界您好！"
  hi: "हैलो वर्ल्ड!"
  es: "¡Hola, Mundo!"
  default: :en // runtime value is "Hello, World!"
}
```

You can index into the properties of looked-up values:

```
{
  deeply: {
    nested: {
      greeting: "Hello, World!"
    }
  }
  greeting: :deeply.nested.greeting
}
```

Lookups are lexically scoped:

```
{
  greeting: "Hello, World!"
  scope: {
    greeting: "Hi, Moon!"
    a: :greeting
  }
  b: :greeting
}
```

Output:

```
{
  greeting: "Hello, World!"
  scope: {
    greeting: "Hi, Moon!"
    a: "Hi, Moon!"
  }
  b: "Hello, World!"
}
```

#### Functions

Functions take exactly one parameter and their body is exactly one expression:

```
a => "Hello, World!"
```

Functions can be applied:

```
(a => :a)("Hello, World!")
```

#### Keywords

The functions and lookups shown above are syntax sugar for _keyword
expressions_. Most of the interesting stuff that Please does involves evaluating
keyword expressions.

Under the hood, keyword expressions are modeled as objects. For example, `:foo`
desugars to `{@lookup key: foo}`. All such expressions have a key `0` referring
to a value that is an `@`-prefixed atom (the keyword). Keywords include
`@function`, `@lookup`, `@apply`, `@check`, `@index`, `@panic`, and `@runtime`.

Currently only `@function`, `@lookup`, `@index`, and `@apply` have syntax
sugars.

### Semantics

Please is a functional programming language. Currently all functions are pure,
with a sole exception: logging to stderr can happen from anywhere. The specific
approach to modeling other runtime side effects is still to be decided.

Once desugared, a Please program is either an atom or an object. Please code is
data in the same sense as in Lisp, though without a macro system there's not
much you can do with this right now.

Before a Please program terminates, it prints the fully-resolved version of
itself to standard output. That means Hello World can be as simple as this:

```
"Hello, World!"
```

`@runtime` expressions allow accessing runtime context (like command-line
arguments). A `@runtime` expression is conceptually a bit like the `main`
function from other programming languages, except there can be any number of
`@runtime` expressions in a given program. Here's an example:

```
{@runtime context => :context.program.start_time}
```

Unsurprisingly, this program outputs the current time when run.

Code outside of `@runtime` expressions is evaluated at compile-time as much as
possible. For example, this program compiles to the literal value `2` (no
computation will occur at runtime):

```
:integer.add(1)(1)
```

There's currently no module system and all Please programs are single files, but
that's only because this is a prototype.

### Layering

Please is a layered language. It can be thought of as a stack of three smaller
languages:

- Layer 0 (`plz`) is the surface syntax. This is the language you as a human
  typically use to write programs.
- Layer 1 (`plo`) is a desugared/normalized representation of the syntax tree.
- Layer 2 (`plt`) is the result of applying semantic analysis, compile-time
  evaluation, and other reductions to the `plo` tree. The prototype
  implementation of the language runtime is a `plt` interpreter.

`plz` has a specific textual representation, but `plo` & `plt` could be encoded
in any format in which hierarchial key/value pairs of strings are representable
(currently only JSON is implemented, but YAML, TOML, HOCON, BSON, S-expressions,
MessagePack, CBOR, etc could be supported).

Take this example `plz` program:

```
{
  language: Please
  message: :atom.prepend("Welcome to ")(:language)
  now: {@runtime context => :context.program.start_time}
}
```

It desugars to the following `plo` program:

```
{
  language: Please
  message: {
    0: @apply
    function: {
      0: @apply
      function: {
        0: @index
        object: {
          0: @lookup
          key: atom
        }
        query: {
          0: prepend
        }
      }
      argument: "Welcome to "
    }
    argument: {
      0: @lookup
      key: language
    }
  }
  now: {
    0: @runtime
    1: {
      0: @function
      parameter: context
      body: {
        0: @index
        object: {
          0: @lookup
          key: context
        }
        query: {
          0: program
          1: start_time
        }
      }
    }
  }
}
```

Which in turn compiles to the following `plt` program:

```
{
  language: Please
  message: "Welcome to Please"
  now: {
    0: @runtime
    function: {
      0: @function
      parameter: context
      body: {
        0: @index
        object: {
          0: @lookup
          key: context
        }
        query: {
          0: program
          1: start_time
        }
      }
    }
  }
}
```

Which produces the following runtime output:

```
{
  language: Please
  message: "Welcome to Please"
  now: "2025-02-14T18:45:14.168Z"
}
```

After an eventual stable release of Please, `plo` & `plt` will be versioned to
ensure backwards compatibility.

Many compilers use intermediate representations (IRs) internally. Please's
layers serve a similar purpose, though unlike some other IRs they are
serializable, stable, and are designed to be human-readable (albeit verbose).

What is this good for? Use cases include:

- distributing lower-layer representations for efficiency in an eventual package
  manager
- experimenting with alternative syntaxes while remaining compatible with the
  rest of the ecosystem
- caching `plo` & `plt` artifacts to speed up recompiles
- applying new optimizations to existing programs without compiling from scratch
- manipulating `plo` & `plt` with any tool that can handle common formats like
  JSON (use [`jq`](https://jqlang.github.io/jq/) to refactor your code!)

### Philosophy

The first-order goal of Please is to be pleasant to use.

It strives to:

- help you express your ideas clearly, concisely, and correctly
- catch mistakes and oversights without being annoying or confusing
- be useful across many different contexts & domains
- be extensible to accommodate novel use cases
- make it easy to pay off technical debt
- emit programs that you have confidence in

The prototype implementation doesn't live up to these aspirations, but hopefully
it approaches them over time.
