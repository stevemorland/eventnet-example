module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/_TESTS_"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testTimeout: 2500000,
};
