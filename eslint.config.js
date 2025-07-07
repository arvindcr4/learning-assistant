const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "error",
      
      // General JavaScript rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      
      // React specific rules  
      "react/no-unescaped-entities": "error",
      "react/jsx-curly-brace-presence": ["error", "never"],
      
      // Import rules
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always"
      }]
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

module.exports = eslintConfig;