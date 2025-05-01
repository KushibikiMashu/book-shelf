import { parseArith } from "npm:tiny-ts-parser"

console.log(parseArith("100"))

// $ deno run -A test.ts
// {
//   tag: "number",
//   n: 100,
//   loc: { end: { column: 3, line: 1 }, start: { column: 0, line: 1 } }
// }