import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    { ignores: ["dist/**", "coverage/**"] },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/strict-boolean-expressions": "warn",
        },
    },
    {
        files: ["src/**/*.js", "scripts/**", "public/**"],
        extends: undefined,
        rules: { "no-undef": "off" },
    }
);
