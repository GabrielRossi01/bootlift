# Fixtures de projeto

Projetos Spring de mentira (não compilam nem rodam) usados para testar o
Bootlift. Cada pasta tem um `expected.json`:

| Campo        | Significado                                                       |
| ------------ | ----------------------------------------------------------------- |
| `expected`   | Achados que as regras **devem** gerar (`ruleId`, `file`, `line`). |
| `traps`      | Linhas parecidas com problemas que **não** podem gerar achado.    |
| `notCovered` | Itens reais de migração que o MVP ainda não detecta (roadmap).    |

`match` é o trecho que identifica a linha. O teste
`__tests__/fixtures.test.ts` garante que `line` e `match` continuam batendo
sempre que alguém editar uma fixture.

| Fixture            | Build               | Boot  | Java |
| ------------------ | ------------------- | ----- | ---- |
| `maven-boot3`      | Maven               | 3.3.5 | 17   |
| `gradle-kts-boot3` | Gradle (Kotlin DSL) | 3.4.1 | 21   |
| `boot4-ready`      | Gradle (Groovy DSL) | 4.0.0 | 25   |

Esta pasta fica fora do Prettier (`.prettierignore`) para que os números de
linha nunca mudem por formatação automática.
