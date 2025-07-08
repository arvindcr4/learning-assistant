const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      // TypeScript specific rules - Enhanced for A+ quality
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "error", // Changed from warn to error
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { 
        "prefer": "type-imports",
        "fixStyle": "separate-type-imports"
      }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "variable",
          "format": ["camelCase", "PascalCase", "UPPER_CASE"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": "function",
          "format": ["camelCase", "PascalCase"]
        },
        {
          "selector": "typeLike",
          "format": ["PascalCase"]
        },
        {
          "selector": "enumMember",
          "format": ["UPPER_CASE"]
        }
      ],
      
      // General JavaScript rules - Enhanced
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "error",
      "no-throw-literal": "error",
      "no-useless-return": "error",
      "no-useless-concat": "error",
      "no-useless-escape": "error",
      "no-duplicate-imports": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",
      "arrow-body-style": ["error", "as-needed"],
      "object-shorthand": ["error", "always"],
      "prefer-destructuring": ["error", {
        "array": false,
        "object": true
      }],
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",
      "no-else-return": "error",
      "yoda": ["error", "never"],
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "consistent-return": "error",
      "default-case": "error",
      "no-fallthrough": "error",
      "no-magic-numbers": ["warn", {
        "ignore": [-1, 0, 1, 2, 100, 1000],
        "ignoreArrayIndexes": true,
        "enforceConst": true,
        "detectObjects": false
      }],
      
      // React specific rules - Enhanced
      "react/no-unescaped-entities": "error",
      "react/jsx-curly-brace-presence": ["error", "never"],
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-fragments": ["error", "syntax"],
      "react/jsx-no-useless-fragment": "error",
      "react/jsx-pascal-case": "error",
      "react/self-closing-comp": "error",
      "react/no-array-index-key": "warn",
      "react/no-danger": "error",
      "react/no-deprecated": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-find-dom-node": "error",
      "react/no-is-mounted": "error",
      "react/no-redundant-should-component-update": "error",
      "react/no-render-return-value": "error",
      "react/no-string-refs": "error",
      "react/no-this-in-sfc": "error",
      "react/no-typos": "error",
      "react/no-unknown-property": "error",
      "react/no-unused-prop-types": "error",
      "react/no-unused-state": "error",
      "react/prefer-es6-class": "error",
      "react/prefer-stateless-function": "error",
      "react/require-render-return": "error",
      "react/sort-comp": "error",
      "react/void-dom-elements-no-children": "error",
      "react/jsx-key": ["error", { "checkFragmentShorthand": true }],
      
      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // Import rules - Enhanced
      "import/order": ["error", {
        "groups": [
          "builtin",
          "external", 
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }],
      "import/no-unresolved": "error",
      "import/no-cycle": "error",
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",
      "import/no-duplicates": "error",
      "import/first": "error",
      "import/exports-last": "error",
      "import/newline-after-import": "error",
      "import/no-anonymous-default-export": "warn",
      "import/no-default-export": "off", // Allow default exports for Next.js pages
      
      // Accessibility rules
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      
      // Security rules
      "no-script-url": "error",
      "no-prototype-builtins": "error",
      
      // Performance rules
      "no-await-in-loop": "warn",
      "no-constant-condition": "error",
      "no-unreachable": "error",
      "no-unreachable-loop": "error",
      
      // Documentation rules
      "jsdoc/check-alignment": "error",
      "jsdoc/check-indentation": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-syntax": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/check-types": "error",
      "jsdoc/implements-on-classes": "error",
      "jsdoc/match-description": "error",
      "jsdoc/newline-after-description": "error",
      "jsdoc/no-undefined-types": "error",
      "jsdoc/require-description": "error",
      "jsdoc/require-description-complete-sentence": "error",
      "jsdoc/require-hyphen-before-param-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-name": "error",
      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-returns-type": "error",
      "jsdoc/valid-types": "error"
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-magic-numbers": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["**/pages/**/*.tsx", "**/app/**/*.tsx"],
    rules: {
      "import/no-default-export": "off",
      "react/function-component-definition": "off",
    },
  },
];

module.exports = eslintConfig;