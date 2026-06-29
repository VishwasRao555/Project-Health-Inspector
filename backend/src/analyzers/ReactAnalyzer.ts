import { Node, SyntaxKind } from "ts-morph";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { relPath, looksLikeComponentFile } from "./util";

/** Detects large components, prop drilling, missing list keys, and deep JSX trees. */
export class ReactAnalyzer implements Analyzer {
  readonly name = "ReactAnalyzer";
  readonly category = "Maintainability" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const projectFiles = new Set(ctx.sourceFiles.map((sf) => sf.getFilePath()));

    for (const sf of ctx.sourceFiles) {
      const rel = relPath(ctx, sf.getFilePath());
      if (!looksLikeComponentFile(rel)) continue;

      const jsxRoots = [
        ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
      if (jsxRoots.length === 0) continue; // not actually a component file

      // Large component = component file with many lines of JSX-bearing code.
      const lineCount = sf.getEndLineNumber();
      if (lineCount > 300) {
        issues.push(
          issue(this, {
            severity: lineCount > 600 ? "high" : "medium",
            issue: `Large component (${lineCount} lines)`,
            rootCause: "Component mixes multiple responsibilities (state, layout, effects).",
            impact: "Hard to maintain, reuse, and test.",
            solution: "Split into smaller presentational and container components.",
            file: rel,
            line: 1,
          })
        );
      }

      // Prop drilling heuristic: component function with too many props. Restricted to
      // functions that actually construct JSX -- a .tsx file commonly also holds plain
      // helpers (string formatters, DOM callbacks, useCallback handlers) whose first
      // parameter has nothing to do with "props".
      for (const fn of [...sf.getFunctions(), ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction)]) {
        if (!constructsJsx(fn)) continue;
        const first = fn.getParameters()[0];
        if (!first) continue;
        const typeNode = first.getTypeNode();
        if (!typeNode) continue;
        // Count members on inline object type or a project-defined interface/type alias.
        const memberCount = countTypeMembers(typeNode, projectFiles);
        if (memberCount > ctx.config.maxComponentProps) {
          issues.push(
            issue(this, {
              severity: "medium",
              issue: `Possible prop drilling (${memberCount} props)`,
              rootCause: "A component accepting many props often forwards state through several layers.",
              impact: "Tight coupling; refactors ripple through the tree.",
              solution: "Lift shared state into context or compose with children.",
              file: rel,
              line: first.getStartLineNumber(),
            })
          );
        }
      }

      // Missing keys in .map() => JSX.
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = call.getExpression();
        if (!Node.isPropertyAccessExpression(expr) || expr.getName() !== "map") continue;
        const cb = call.getArguments()[0];
        if (!cb || (!Node.isArrowFunction(cb) && !Node.isFunctionExpression(cb))) continue;
        const returnedJsx = findReturnedJsx(cb);
        if (returnedJsx && !hasKeyProp(returnedJsx)) {
          issues.push(
            issue(this, {
              severity: "medium",
              issue: "Missing key prop in list rendering",
              rootCause: "JSX returned from .map() has no stable `key` prop.",
              impact: "React cannot diff list items reliably, causing render bugs.",
              solution: "Add a stable, unique `key` to the top element returned in the map.",
              file: rel,
              line: call.getStartLineNumber(),
            })
          );
        } else if (returnedJsx) {
          const indexParam = cb.getParameters()[1];
          const keyValue = indexParam ? keyExpressionText(returnedJsx) : undefined;
          if (indexParam && keyValue && keyValue === indexParam.getName()) {
            issues.push(
              issue(this, {
                severity: "low",
                issue: "Array index used as key in list rendering",
                rootCause: `\`key={${keyValue}}\` uses the map index instead of a stable identifier.`,
                impact: "Reordering or inserting items causes React to misattribute state across rows.",
                solution: "Use a stable id from the data instead of the array index.",
                file: rel,
                line: call.getStartLineNumber(),
              })
            );
          }
        }
      }

      // Deep component tree (deep JSX nesting).
      const maxDepth = Math.max(0, ...jsxRoots.map(jsxDepth));
      if (maxDepth > 8) {
        issues.push(
          issue(this, {
            severity: "low",
            issue: `Deep component tree (nesting depth ${maxDepth})`,
            rootCause: "JSX nested very deeply in a single component.",
            impact: "Reduces readability and complicates styling/state flow.",
            solution: "Extract nested blocks into child components.",
            file: rel,
            line: 1,
          })
        );
      }
    }

    return issues;
  }
}

function countTypeMembers(typeNode: Node, projectFiles: Set<string>): number {
  // Inline object type literal: `(props: { a: string; b: string }) => ...`
  if (Node.isTypeLiteral(typeNode)) return typeNode.getMembers().length;

  // Reference to an interface/type alias, resolved via the type checker so it works
  // across files (the normal case once props move to their own file) -- but only counted
  // if the declaration lives in the project being analyzed. Without that guard, a
  // primitive (`string`), DOM type (`File`, `HTMLElement`), array, or string-literal union
  // resolves to its ambient lib.d.ts type and `.getProperties()` returns every inherited
  // prototype member (e.g. all of String.prototype) -- a large number that has nothing to
  // do with "props".
  const decl = typeNode
    .getType()
    .getSymbol()
    ?.getDeclarations()
    .find((d) => projectFiles.has(d.getSourceFile().getFilePath()));
  if (Node.isInterfaceDeclaration(decl)) return decl.getProperties().length;
  if (Node.isTypeAliasDeclaration(decl)) {
    const aliased = decl.getTypeNode();
    if (aliased && Node.isTypeLiteral(aliased)) return aliased.getMembers().length;
  }
  return 0;
}

/** True if a function/arrow-function's body constructs JSX anywhere -- the cheap, robust
 * signal that it's an actual component rather than a helper that merely lives in a .tsx file. */
function constructsJsx(fn: Node): boolean {
  return (
    fn.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    fn.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    fn.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

function findReturnedJsx(fn: Node): Node | undefined {
  if (Node.isArrowFunction(fn)) {
    const body = fn.getBody();
    if (Node.isJsxElement(body) || Node.isJsxSelfClosingElement(body) || Node.isJsxFragment(body)) {
      return body;
    }
    if (Node.isParenthesizedExpression(body)) {
      const inner = body.getExpression();
      if (Node.isJsxElement(inner) || Node.isJsxSelfClosingElement(inner)) return inner;
    }
  }
  const ret = fn.getFirstDescendantByKind(SyntaxKind.ReturnStatement);
  const expr = ret?.getExpression();
  if (expr && (Node.isJsxElement(expr) || Node.isJsxSelfClosingElement(expr))) return expr;
  if (expr && Node.isParenthesizedExpression(expr)) {
    const inner = expr.getExpression();
    if (Node.isJsxElement(inner) || Node.isJsxSelfClosingElement(inner)) return inner;
  }
  return undefined;
}

function hasKeyProp(jsx: Node): boolean {
  const open = Node.isJsxElement(jsx) ? jsx.getOpeningElement() : jsx;
  if (Node.isJsxSelfClosingElement(open) || Node.isJsxOpeningElement(open)) {
    return open.getAttributes().some((a) => Node.isJsxAttribute(a) && a.getNameNode().getText() === "key");
  }
  return false;
}

/** Text of the `key={...}` expression, if any, on a JSX element/self-closing element. */
function keyExpressionText(jsx: Node): string | undefined {
  const open = Node.isJsxElement(jsx) ? jsx.getOpeningElement() : jsx;
  if (!Node.isJsxSelfClosingElement(open) && !Node.isJsxOpeningElement(open)) return undefined;
  const attr = open.getAttributes().find((a) => Node.isJsxAttribute(a) && a.getNameNode().getText() === "key");
  if (!attr || !Node.isJsxAttribute(attr)) return undefined;
  const init = attr.getInitializer();
  if (!init || !Node.isJsxExpression(init)) return undefined;
  return init.getExpression()?.getText();
}

/** Depth of nested JSX elements below (and including) this node. */
function jsxDepth(node: Node): number {
  let max = 0;
  for (const desc of node.getChildren()) {
    max = Math.max(max, jsxChildDepth(desc));
  }
  return 1 + max;
}

/**
 * Looks arbitrarily deep through non-JSX syntax (expression containers, `&&`/ternary
 * conditions, `.map()` callback bodies) to find nested JSX, then switches to jsxDepth's
 * depth-counting once found. A direct-children-only search misses JSX reached through
 * conditional rendering or list rendering -- both extremely common React patterns.
 */
function jsxChildDepth(node: Node): number {
  if (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) {
    return jsxDepth(node);
  }
  let max = 0;
  for (const child of node.getChildren()) {
    max = Math.max(max, jsxChildDepth(child));
  }
  return max;
}
