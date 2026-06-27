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

      // Prop drilling heuristic: component function with too many props.
      for (const fn of [...sf.getFunctions(), ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction)]) {
        const first = fn.getParameters()[0];
        if (!first) continue;
        const typeNode = first.getTypeNode();
        if (!typeNode) continue;
        // Count members on inline object type or referenced interface.
        const memberCount = countTypeMembers(typeNode);
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

function countTypeMembers(typeNode: Node): number {
  if (Node.isTypeLiteral(typeNode)) return typeNode.getMembers().length;
  if (Node.isTypeReference(typeNode)) {
    // Best-effort: look up an interface declaration with the same name in the project.
    const name = typeNode.getTypeName().getText();
    const sf = typeNode.getSourceFile();
    const iface = sf.getInterface(name);
    if (iface) return iface.getProperties().length;
  }
  return 0;
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
    if (Node.isJsxElement(desc) || Node.isJsxSelfClosingElement(desc)) {
      max = Math.max(max, jsxDepth(desc));
    } else {
      for (const gc of desc.getChildrenOfKind(SyntaxKind.JsxElement)) {
        max = Math.max(max, jsxDepth(gc));
      }
    }
  }
  return 1 + max;
}
