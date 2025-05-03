// 真偽値と数値のみを持つプログラミング言語の型検査機を作る
// true, false, 三項演算子、数値リテラル、足し算
// 1+2 -> OK, 1+true -> NG

import { parseArith } from "npm:tiny-ts-parser";

// 項
type Term = 
    | { tag: "true" }
    | { tag: "false" }
    | { tag: "if", cond: Term, thn: Term, els: Term }
    | { tag: "number", n: number }
    | { tag: "add", left: Term, right: Term }

type Type =
    | { tag: "Boolean" }
    | { tag: "Number" }

// 項（ここでは抽象構文木）を受け取り、OK な項に対してはその型を返し、NG な項に対しては例外を投げる
// 項が子を持つ場合には、再帰呼び出しを使って子の項の型を推定する
// t は項
// Term -> Type
function typecheck(t: Term): Type {
    switch(t.tag) {
        case "true":
            return { tag: "Boolean" }
        case "false":
            return { tag: "Boolean" }
        case "if": {
            const condTy = typecheck(t.cond)
            if (condTy.tag !== "Boolean") {
                throw "boolean expected"
            }
            const thnTy = typecheck(t.thn)
            const elsTy = typecheck(t.els)
            if (thnTy.tag !== elsTy.tag) {
                throw "then and else have different types"
            }
            return thnTy
        }
        case "number":
            return { tag: "Number" }
        case "add": {
            const leftTy = typecheck(t.left)
            if (leftTy.tag !== "Number") {
                throw "number expected"
            }
            const rightTy = typecheck(t.right)
            if (rightTy.tag !== "Number") {
                throw "number expected"
            }
            return { tag: "Number" }
        }
    }
}

// {
//   tag: "add",
//   left: {
//     tag: "number",
//     n: 1,
//     loc: { end: { column: 1, line: 1 }, start: { column: 0, line: 1 } }
//   },
//   right: {
//     tag: "number",
//     n: 2,
//     loc: { end: { column: 5, line: 1 }, start: { column: 4, line: 1 } }
//   },
//   loc: { end: { column: 5, line: 1 }, start: { column: 0, line: 1 } }
// }
console.log(parseArith("1 + 2"))

// { tag: "Number" }
console.log(typecheck(parseArith("1 + 2")))

// { tag: "Number" }
console.log(typecheck(parseArith("1 + (2 + 3)")))

// error: Uncaught (in promise) "boolean expected"
console.log(typecheck(parseArith("1 ? 2 : 3")))

// error: Uncaught (in promise) "then and else have different types"
console.log(typecheck(parseArith("true ? 1 : true")))

