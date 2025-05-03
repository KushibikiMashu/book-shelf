import { error, parseRecFunc } from "npm:tiny-ts-parser";

// 再帰関数を追加
// - 再帰関数を定義するときはfunctionの構文を使わなければならない
// - 関数の返す値の型が、構文で明示された返り値の型と一致すること
// ex. function f(x: number): number { return f(x); }

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
    | { tag: "const"; name: string; init: Term; rest: Term }
    | { tag: "objectNew"; props: PropertyTerm[] }
    | { tag: "objectGet"; obj: Term; propName: string }
    | { tag: "recFunc"; funcName: string; params: Param[]; retType: Type; body: Term; rest: Term }; // 再帰関数

type Param = { name: string; type: Type }
type PropertyTerm = { name: string; term: Term }

type Type =
    | { tag: "Boolean" }
    | { tag: "Number" }
    | { tag: "Func"; params: Param[]; retType: Type }
    | { tag: "Object"; props: PropertyType[] };

type PropertyType = { name: string; type: Type };

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
        case "Object": {
            if (ty1.tag !== "Object") return false
            if (ty1.props.length !== ty2.props.length) return false
            for (const prop2 of ty2.props) {
                const prop1 = ty1.props.find((prop1) => prop1.name === prop2.name)
                if (!prop1) return false
                const isSamePropType = typeEq(prop1.type, prop2.type)
                if (!isSamePropType) return false
            }
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
        case "objectNew": {
            const props = t.props.map(
                ({ name, term }) => ({ name, type: typecheck(term, tyEnv) })
            )
            return { tag: "Object", props }
        }
        case "objectGet": {
            const objectTy = typecheck(t.obj, tyEnv)
            if (objectTy.tag !== "Object") error("object type expected", t.obj)
            const prop = objectTy.props.find((prop) => prop.name === t.propName)
            if (!prop) error(`unknown property name: ${t.propName}`, t)
            return prop.type
        }
        case "recFunc": {
            const funcTy: Type = { tag: "Func", params: t.params, retType: t.retType }
            const newTyEnv = { ...tyEnv }
            for (const { name, type } of t.params) {
                newTyEnv[name] = type
            }
            newTyEnv[t.funcName] = funcTy
            const retType = typecheck(t.body, newTyEnv) // newTyEnv は関数の body で変数参照をするために使う
            if (!typeEq(t.retType, retType)) error("wrong return type", t)
            const newTyEnv2 = { ...tyEnv, [t.funcName]: funcTy }
            return typecheck(t.rest, newTyEnv2) // newTyEnv2 は後続の処理（rest）で、ここで定義された関数名を参照するために使う
        }
        default:
            throw "typecheck error"
    }
}

const check = (code: string) => {
    try {
        return typecheck(parseRecFunc(code), {})
    } catch(e: any) {
        const msg = e?.message || e
        return `error: ${msg}`
    }
}
const out = (x: any) => console.dir(x, {depth: null})

// {
//   tag: "Func",
//   params: [ { name: "x", type: { tag: "Number" } } ],
//   retType: { tag: "Number" }
// }
out(check(`
    function f(x: number): number { return f(x); }; f
`))

// { tag: "Number" }
out(check(`
    function f(x: number): number { return f(x); };
    f(0)
`))
