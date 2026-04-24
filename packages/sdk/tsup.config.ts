import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        react: "src/react.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    splitting: false,
    treeshake: true,
    target: "es2020",
    platform: "browser",
    tsconfig: "tsconfig.build.json",
    // Bundle the internal workspace packages into the SDK so consumers install
    // a single package and do not need to resolve @luma/* from their own tree.
    // All public-facing types are mirrored locally in src/public-types.ts so
    // the generated .d.ts is fully self-contained.
    noExternal: [/^@luma\//],
    external: [
        "react",
        "react-dom",
        "@tanstack/query-core",
        "socket.io-client",
    ],
    outExtension({ format }) {
        return {
            js: format === "esm" ? ".js" : ".cjs",
        };
    },
});
