import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const eslintConfig = [
  { ignores: ["bridge/**", ".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
]

export default eslintConfig
