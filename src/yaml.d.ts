// Permite `import rules from './rules/boot4.rules.yml'` (via @rollup/plugin-yaml).
declare module '*.yml' {
  const data: unknown
  export default data
}
