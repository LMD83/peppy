import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * The things that only break at `npx convex deploy`.
 *
 * This file exists because of a specific, avoidable failure. The reminder work
 * shipped with two defects that every green check missed:
 *
 *  1. Thirteen `logic-*.ts` modules whose hyphenated paths Convex rejects, so
 *     they had never reached a deployment — dating back to the first slices.
 *  2. `crons.ts` importing a constant from the `"use node"` module, which drags
 *     `web-push` into the default runtime and fails the deploy.
 *
 * Neither was catchable by what CI ran. Vitest resolves modules through Vite,
 * which is perfectly happy with hyphens; `tsc` has no opinion about Convex
 * runtimes; `next build` never looks at `convex/` at all. The tests were green
 * on files Convex would refuse to accept.
 *
 * There was a test claiming to guard the runtime split, and it passed. It
 * asserted that push.ts *starts with* the pragma and that crons.ts *mentions*
 * the right function reference — both true, and neither one the actual rule.
 * The rule is a property of the import graph, so this checks the import graph.
 *
 * `npx convex deploy --dry-run` is the authority and CI runs it when a deploy
 * key is available (see .github/workflows/ci.yml). These checks need no
 * credentials, so they run on every PR and fail in seconds rather than at the
 * end of a deploy.
 */

const CONVEX = join(process.cwd(), "convex");
const GENERATED = join(CONVEX, "_generated");

/** Convex treats these two specially; they are not addressable modules. */
const NOT_MODULES = new Set(["convex.config", "schema"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (full.startsWith(GENERATED)) return [];
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
  });
}

const files = walk(CONVEX);

/** "convex/tm/push.ts" → "tm/push" */
function modulePath(file: string): string {
  return relative(CONVEX, file).split(sep).join("/").replace(/\.ts$/, "");
}

/** A file is in the Node runtime iff its very first statement is the pragma. */
function isNodeRuntime(file: string): boolean {
  return /^\s*["']use node["']/.test(readFileSync(file, "utf8"));
}

/**
 * Value imports only.
 *
 * `import type { X } from "./y"` is erased by the compiler and reaches no
 * runtime, so a type-only edge cannot drag a Node module into the default
 * runtime. Treating those as real edges would condemn push.ts's own
 * `import type { SweepBatch } from "./remind"`, which is correct code.
 */
function valueImports(file: string): string[] {
  const body = readFileSync(file, "utf8");
  const out: string[] = [];
  const statement = /(?:^|\n)\s*(import|export)(\s+type)?\b[^;\n]*?from\s*["']([^"']+)["']/g;
  for (const m of body.matchAll(statement)) {
    if (m[2] !== undefined) continue; // `import type ...` / `export type ...`
    out.push(m[3]);
  }
  // Bare side-effect imports: `import "./x"`.
  for (const m of body.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}

/** Resolve a relative specifier to a file on disk, or null for a package. */
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec.replace(/\.js$/, ""));
  for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

describe("every module under convex/ can be addressed by Convex", () => {
  it("names each path segment as a valid identifier", () => {
    // Convex turns every module path into an identifier in the generated api
    // ("tm/logicPush" → tm_logicPush) and into a dotted function reference
    // (internal.tm.push.sweep). A hyphen cannot appear in either, so a file
    // named logic-push.ts is simply not deployable — however well it tests.
    const bad = files
      .map(modulePath)
      // convex.config and schema are reserved filenames Convex looks for by
      // name; they are never addressed through the api object, so the dot in
      // "convex.config" is fine where a hyphen in a real module would not be.
      .filter((p) => !NOT_MODULES.has(p))
      .filter((p) => p.split("/").some((seg) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)));
    expect(
      bad,
      "these Convex module paths are not valid identifiers — rename them (logic-push.ts → logicPush.ts)",
    ).toEqual([]);
  });

  it("has a generated api that still matches the filesystem", () => {
    // api.d.ts is generated, and it has been hand-edited in this repo before —
    // which is its own way of shipping a module the deployment never sees. If
    // this drifts, run `npx convex codegen` rather than editing it.
    const api = readFileSync(join(GENERATED, "api.d.ts"), "utf8");
    const declared = new Set(
      [...api.matchAll(/from "\.\.\/([^"]+)\.js"/g)].map((m) => m[1]),
    );
    const missing = files
      .map(modulePath)
      .filter((p) => !NOT_MODULES.has(p) && !declared.has(p));
    expect(missing, "modules on disk that the generated api does not declare").toEqual([]);
  });
});

describe("the Node runtime does not leak into the default runtime", () => {
  const nodeFiles = files.filter(isNodeRuntime);

  it("has at least one Node-runtime module, so this suite is not vacuous", () => {
    expect(nodeFiles.map(modulePath)).toContain("tm/push");
  });

  it("exports only actions from a Node-runtime module", () => {
    // Convex allows actions alone in a "use node" file. A query or mutation
    // there fails the deploy, which is why remind.ts stayed where it is.
    for (const file of nodeFiles) {
      const body = readFileSync(file, "utf8");
      const offenders = [...body.matchAll(/\b(internal)?(Query|Mutation|query|mutation)\s*\(\{/g)]
        .map((m) => m[0])
        .filter((s) => !/action/i.test(s));
      expect(offenders, `${modulePath(file)} exports a query or mutation`).toEqual([]);
    }
  });

  it("is unreachable by value-import from any default-runtime module", () => {
    // The real rule, and the one the previous test missed: it is not about what
    // crons.ts mentions, it is about what the import graph can reach. A second
    // hop through an innocent-looking helper bundles web-push exactly the same.
    //
    // Note that a *function reference* is not an import: crons.ts reaching
    // internal.tm.push.sweep through the generated api is precisely how a
    // default-runtime module is meant to invoke a Node action.
    const nodeSet = new Set(nodeFiles);
    const failures: string[] = [];

    for (const entry of files.filter((f) => !nodeSet.has(f))) {
      const seen = new Set<string>([entry]);
      const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [modulePath(entry)] }];

      while (queue.length > 0) {
        const { file, chain } = queue.shift() as { file: string; chain: string[] };
        for (const spec of valueImports(file)) {
          const target = resolveImport(file, spec);
          if (target === null || seen.has(target)) continue;
          seen.add(target);
          const nextChain = [...chain, modulePath(target)];
          if (nodeSet.has(target)) {
            failures.push(nextChain.join(" → "));
            continue;
          }
          queue.push({ file: target, chain: nextChain });
        }
      }
    }

    expect(
      failures,
      'a default-runtime module reaches a "use node" module through a value import, which bundles its ' +
        "Node dependencies into the default runtime and fails the deploy — move the shared value into a " +
        "pure module both runtimes can import, or call the action through the generated api instead",
    ).toEqual([]);
  });
});
