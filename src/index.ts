async function read(stream: AsyncIterable<string>): Promise<string> {
  let source: string = ''
  for await (const chunk of stream) {
    source += chunk
  }
  return source
}

async function main(process: NodeJS.Process): Promise<undefined> {
  process.stdout.write(await read(process.stdin))
}

await main(process)
