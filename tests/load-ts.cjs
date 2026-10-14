/* Test local TypeScript modules with explicit boundary mocks, without a new test dependency. */
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");

function createLoader(mocks = {}) {
  const cache = new Map();
  return function load(specifier) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    const roots = { "@jobhunt/api/": "apps/api/src/", "@jobhunt/shared/": "packages/shared/src/", "@/": "apps/web/src/" };
    const prefix = Object.keys(roots).find((prefix) => specifier.startsWith(prefix));
    let local = prefix ? roots[prefix] + specifier.slice(prefix.length) : specifier;
    if (specifier === "@jobhunt/shared/types") local = "packages/shared/src/types/index";
    if (specifier === "@jobhunt/shared/ai") local = "packages/shared/src/types/ai";
    const base = path.resolve(__dirname, "..", local);
    const filename = fs.existsSync(base + ".ts") ? base + ".ts" : base + ".tsx";
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        experimentalDecorators: true,
      },
      fileName: filename,
    }).outputText;
    const nativeRequire = createRequire(filename);
    const requireModule = (name) => {
      if (name.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), name);
        if (fs.existsSync(relative + ".ts") || fs.existsSync(relative + ".tsx")) {
          const root = path.resolve(__dirname, "..");
          const relativePath = path.relative(root, relative).replaceAll("\\", "/");
          const aliases = { "apps/api/src/": "@jobhunt/api/", "apps/web/src/": "@/", "packages/shared/src/": "@jobhunt/shared/" };
          const prefix = Object.keys(aliases).find((prefix) => relativePath.startsWith(prefix));
          return load(prefix ? aliases[prefix] + relativePath.slice(prefix.length) : relativePath);
        }
      }
      return (name.startsWith("@/") || name.startsWith("@jobhunt/")) || name === "server-only" || Object.hasOwn(mocks, name) ? load(name) : nativeRequire(name);
    };
    new Function("require", "module", "exports", output)(
      requireModule,
      loadedModule,
      loadedModule.exports,
    );
    return loadedModule.exports;
  };
}
module.exports = { createLoader };
