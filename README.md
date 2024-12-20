# Please

An exploratory programming language.

## Quick start

```sh
git clone git@github.com:mkantor/please-prototype.git
cd please-prototype
npm install
npm run build
echo '{@runtime context => :context.program.start_time}' | ./please --output-format=json
```

## What this repository is

**This implementation of Please is a proof of concept**. There are bugs and missing pieces, and
language syntax/semantics may change backwards-incompatibly on the way to an official release.
TypeScript was chosen because it's pretty good for rapid prototyping, but it's likely that another
language would be used in a non-prototype implementation.

## Current state

Enough pieces exist to write basic runnable programs. There is a type system, but it's not wired up
in many places yet so mistakes often go unnoticed at compile time. The standard library is anemic
and documentation is nonexistent.

The current runtime is an interpreter, but the plan is to eventually add one or more backends to
allow building native executables.

## What's next?

I'm focused on squashing compiler bugs and establishing solid foundations to build atop. Along the
way I've been slowly fleshing out the type system and standard library.
