import path from "node:path";

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { configs, plugins } from "eslint-config-airbnb-extended";
import { rules as prettierConfigRules } from "eslint-config-prettier";
import jsoncPlugin from "eslint-plugin-jsonc";
import prettierPlugin from "eslint-plugin-prettier";

const gitignorePath = path.resolve(".", ".gitignore");

const commonJsFiles = [];

const ignoredFilesConfig = defineConfig([
  {
    name: "ignored/local-generated",
    ignores: ["next-env.d.ts"],
  },
]);

const jsConfig = defineConfig([
  {
    name: "js/config",
    ...js.configs.recommended,
  },
  plugins.stylistic,
  plugins.importX,
  ...configs.base.recommended,
  ...(commonJsFiles.length > 0
    ? [
        {
          name: "js/commonjs",
          files: commonJsFiles,
          languageOptions: {
            sourceType: "commonjs",
            globals: {
              __dirname: "readonly",
              AbortController: "readonly",
              fetch: "readonly",
              module: "readonly",
              process: "readonly",
              require: "readonly",
              URL: "readonly",
            },
          },
        },
      ]
    : []),
]);

const nextConfig = defineConfig([
  plugins.react,
  plugins.reactHooks,
  plugins.reactA11y,
  plugins.next,
  ...configs.next.recommended,
]);

const typescriptConfig = defineConfig([
  plugins.typescriptEslint,
  ...configs.base.typescript,
  ...configs.next.typescript,
]);

const prettierConfig = defineConfig([
  {
    name: "prettier/plugin/config",
    plugins: {
      prettier: prettierPlugin,
    },
  },
  {
    name: "prettier/config",
    rules: {
      ...prettierConfigRules,
      "prettier/prettier": "error",
    },
  },
]);

const jsoncConfig = defineConfig([
  ...jsoncPlugin.configs["flat/recommended-with-jsonc"],
  {
    name: "jsonc/custom-rules",
    files: ["**/*.json"],
    rules: {
      "jsonc/sort-keys": "off",
    },
  },
]);

const customConfig = defineConfig([
  {
    name: "custom/rules",
    ignores: ["**/*.json"],
    rules: {
      semi: "off",
      "arrow-body-style": "off",
      "import-x/no-cycle": "off",
      "import-x/no-extraneous-dependencies": "off",
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/prefer-default-export": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "no-console": ["error", { allow: ["warn", "error", "info", "table", "trace"] }],
      "no-underscore-dangle": "off",
      "no-useless-catch": "off",
      "react/require-default-props": "off",
    },
  },
]);

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  ...ignoredFilesConfig,
  ...jsConfig,
  ...nextConfig,
  ...typescriptConfig,
  ...prettierConfig,
  ...jsoncConfig,
  ...customConfig,
]);
