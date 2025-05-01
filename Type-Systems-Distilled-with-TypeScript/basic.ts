// 以下の構文を追加する
// - 変数参照（例：「x」、「f」）
// - 無名関数（例：「(x: number) => x」）
// - 関数呼び出し（例：「f(1)」、「f(true)」）
// - 逐次実行（例：「f(1); f(2);」）
// - 変数定義（例：「const x = 1」）

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
    | { tag: "Number" };

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
