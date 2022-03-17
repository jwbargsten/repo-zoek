module.exports = {
  extends: ["airbnb-base", "airbnb-typescript/base", "plugin:prettier/recommended"],
  parserOptions: {
    project: "./tsconfig.spec.json",
  },
  rules: {
    "prettier/prettier": "error",
    "import/prefer-default-export": "off",
    "no-restricted-syntax": "off",
    "prefer-template": "off",
    "no-console": "off",
    "no-continue": "off",
    "no-bitwise": ["error", { allow: ["~"] }],
  },
};
