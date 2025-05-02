// 以下の構文を追加する
// - 変数参照（例：「x」、「f」）
// - 無名関数（例：「(x: number) => x」）
// - 関数呼び出し（例：「f(1)」、「f(true)」）
// - 逐次実行（例：「f(1); f(2);」）
// - 変数定義（例：「const x = 1」）

import { error, parseBasic } from "npm:tiny-ts-parser";

// 以下を守る
// - 未定義変数を参照しないこと
// - 関数呼び出しでは、呼び出されるものが関数であること
// - 関数呼び出しでは、仮引数と実引数について、型と個数が完全に一致していること

type Term = 
    | { tag: "true" }
    | { tag: "false" }
    | { tag: "if"; cond: Term; thn: Term; els: Term }
    | { tag: "number"; n: number }
    | { tag: "add"; left: Term; right: Term }
    | { tag: "var"; name: string } // 変数参照
    | { tag: "func"; params: Param[]; body: Term }
    | { tag: "call"; func: Term; args: Term[] }
    | { tag: "seq"; body: Term; rest: Term } // 逐次実行
    | { tag: "const"; name: string; init: Term; rest: Term };

type Param = { name: string; type: Type }

type Type =
    | { tag: "Boolean" }
    | { tag: "Number" }
    | { tag: "Func"; params: Param[]; retType: Type };

function typeEq(ty1: Type, ty2: Type): boolean {
    switch (ty2.tag) {
        case "Boolean":
            return ty1.tag === "Boolean"
        case "Number":
            return ty1.tag === "Number"
        case "Func": {
            if (ty1.tag !== "Func") return false
            if (ty1.params.length !== ty2.params.length) return false
            for (let i = 0; i < ty1.params.length; i++) {
                const isSameParamType = typeEq(ty1.params[i].type, ty2.params[i].type)
                if (!isSameParamType) return false
            }
            const isSameRetType = typeEq(ty1.retType, ty2.retType)
            if (!isSameRetType) return false
            return true
        }
        default:
            throw "typeEq error"
    }
}

// 型環境: 変数が現在どういう型を持っているか
type TypeEnv = Record<string, Type>

// Term -> Type
function typecheck(t: Term, tyEnv: TypeEnv): Type {
    switch(t.tag) {
        case "true":
            return { tag: "Boolean" }
        case "false":
            return { tag: "Boolean" }
        case "if": {
            const condTy = typecheck(t.cond, tyEnv)
            if (condTy.tag !== "Boolean") {
                error("boolean expected", t.cond)
            }
            const thnTy = typecheck(t.thn, tyEnv)
            const elsTy = typecheck(t.els, tyEnv)
            if (!typeEq(thnTy, elsTy)) {
                error("then and else have different types", t)
            }
            return thnTy
        }
        case "number":
            return { tag: "Number" }
        case "add": {
            const leftTy = typecheck(t.left, tyEnv)
            if (leftTy.tag !== "Number") {
                error("number expected", t.left)
            }
            const rightTy = typecheck(t.right, tyEnv)
            if (rightTy.tag !== "Number") {
                error("number expected", t.right)
            }
            return { tag: "Number" }
        }
        case "var": {
            if (typeof tyEnv[t.name] === "undefined") {
                error(`unknown variable: ${t.name}`, t)
            }
            return tyEnv[t.name]
        }
        case "func": {
            const newTyEnv = { ...tyEnv }
            for (const { name, type } of t.params) {
                newTyEnv[name] = type
            }
            const retType = typecheck(t.body, newTyEnv)
            return { tag: "Func", params: t.params, retType }
        }
        case "call": {
            const funcTy = typecheck(t.func, tyEnv)
            if (funcTy.tag !== "Func") error("function type expected", t.func)
            if (funcTy.params.length !== t.args.length) error("wrong number of arguments", t)
            for (let i = 0; i < t.args.length; i++) {
                const argTy = typecheck(t.args[i], tyEnv)
                const isParamAndArgSameType = typeEq(funcTy.params[i].type, argTy)
                if (!isParamAndArgSameType) error("parameter type mismatch", t.args[i])
            }
            return funcTy.retType
        }
        case "seq": {
            typecheck(t.body, tyEnv)
            return typecheck(t.rest, tyEnv)
        }
        case "const": {
            const ty = typecheck(t.init, tyEnv)
            const newTyEnv = { ...tyEnv, [t.name]: ty }
            return typecheck(t.rest, newTyEnv)
        }
        default:
            throw "typecheck error"
    }
}

const check = (code: string) => {
    try {
        return typecheck(parseBasic(code), {})
    } catch(e: any) {
        const msg = e?.message || e
        return `error: ${msg}`
    }
}
const out = (x: object | string) => console.dir(x, {depth: null})

// {
//   tag: "Func",
//   params: [ { name: "x", type: { tag: "Boolean" } } ],
//   retType: { tag: "Boolean" }
// }
out(check("(x: boolean) => x"))

// { tag: "Number" }
out(check("( (x: number) => x )(42)"))

// error: parameter type mismatch
out(check("( (x: number) => x )(true)"))

// error: unknown variable: y
out(check("(x: number) => y"))

// error: wrong number of arguments
out(check("( (x: number) => x )(1, 2, 3)"))

// {
//   tag: "Func",
//   params: [
//     {
//       name: "f",
//       type: {
//         tag: "Func",
//         params: [ { name: "x", type: { tag: "Number" } } ],
//         retType: { tag: "Number" }
//       }
//     }
//   ],
//   retType: { tag: "Number" }
// }
out(check("(f: (x: number) => number ) => 1"))

// { tag: "Number" }
out(check(`
const add = (x: number, y: number) => x + y;
const select = (b: boolean, x: number, y: number) => b ? x : y;
const x = add(1, add(2, 3));
const y = select(true, x, x);

y;
`))
