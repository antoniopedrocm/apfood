module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    "quote-props": ["error", "as-needed"],
    "max-len": ["error", 120],
    indent: ["error", 2],
    "no-tabs": "error",
    "object-curly-spacing": ["error", "never"],
    "no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
    "no-inner-declarations": "error",
    "require-jsdoc": ["error", {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: false,
        ClassDeclaration: false,
        ArrowFunctionExpression: false,
        FunctionExpression: false,
      },
    }],
    "comma-dangle": ["error", "always-multiline"],
    "padded-blocks": ["error", "never"],
    "operator-linebreak": ["error", "before"],
    "no-trailing-spaces": "error",
  },
};
