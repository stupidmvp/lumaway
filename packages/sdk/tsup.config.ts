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
    // Bundle the internal workspace packages into the SDK so consumers install
    // a single package and do not need to resolve @luma/* from their own tree.
    noExternal: [/^@luma\//],
    // Keep these as external — the consumer's app will provide them.
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
