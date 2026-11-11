<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/bootlift-logo-dark.svg">
    <img src="./.github/assets/bootlift-logo-light.svg" alt="Bootlift — Spring Boot 4 Readiness Check" width="380">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/GabrielRossi01/bootlift/actions/workflows/ci.yml"><img src="https://github.com/GabrielRossi01/bootlift/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/GabrielRossi01/bootlift/actions/workflows/check-dist.yml"><img src="https://github.com/GabrielRossi01/bootlift/actions/workflows/check-dist.yml/badge.svg" alt="Check dist/"></a>
  <a href="https://github.com/GabrielRossi01/bootlift/actions/workflows/codeql-analysis.yml"><img src="https://github.com/GabrielRossi01/bootlift/actions/workflows/codeql-analysis.yml/badge.svg" alt="CodeQL"></a>
  <img src="./badges/coverage.svg" alt="Coverage">
</p>

GitHub Action que mede o quanto um projeto Java está pronto para o **Spring Boot
4** e age direto no pull request:

- **Guardrail:** em PRs, só as linhas adicionadas podem reprovar o job. O legado
  entra no score, mas não trava ninguém, e a migração para de piorar.
- **Correção em 1 clique:** regras com correção determinística viram uma
  _suggestion_ na própria linha do PR.
- **Análise estática:** lê `pom.xml`, Gradle (Groovy e Kotlin DSL),
  `application.*` e o código Java/Kotlin, sem compilar e sem JDK no runner.

> [!NOTE]
>
> **Status: Dia 2 (scanner).** A action já lê o projeto (Maven, Gradle Groovy e
> Kotlin DSL, version catalog, `application.*` e código Java/Kotlin) e descobre
> as versões de Spring Boot, Java e Gradle. As regras (Dia 3) e os relatórios no
> PR (Dias 4 e 5) chegam nos próximos dias.

## Uso

```yaml
name: Spring Boot 4 readiness
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  bootlift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: GabrielRossi01/bootlift@v1
        with:
          fail-on: error
```

### Inputs

| Input           | Padrão                | Descrição                                                                                         |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| `path`          | `.`                   | Raiz do projeto a analisar.                                                                       |
| `mode`          | _(vazio)_             | `guardrail` ou `full`. Vazio = `guardrail` em `pull_request`, `full` nos demais eventos.          |
| `fail-on`       | `error`               | Severidade mínima que reprova o job: `none`, `warning` ou `error`.                                |
| `comment-on-pr` | `true`                | Publica ou atualiza o comentário com o relatório no PR.                                           |
| `github-token`  | `${{ github.token }}` | Token para ler o diff do PR e comentar. Em PRs de fork ele é somente leitura e a action só avisa. |

### Outputs

| Output     | Descrição                                                |
| ---------- | -------------------------------------------------------- |
| `score`    | Nota de prontidão de 0 a 100 para o repositório inteiro. |
| `blocking` | Achados que podem reprovar o job no modo atual.          |
| `errors`   | Achados de severidade `error` no repositório inteiro.    |

## Regras do MVP (v1.0)

| Regra                | O que detecta                                                       | Severidade |
| -------------------- | ------------------------------------------------------------------- | ---------- |
| `BOOT_VERSION`       | Spring Boot abaixo de 3.5 (suba para 3.5.x antes do 4.0)            | warning    |
| `JAVA_BASELINE`      | Java abaixo de 17                                                   | error      |
| `GRADLE_VERSION`     | Gradle Wrapper abaixo de 8.14                                       | error      |
| `JAKARTA_NAMESPACE`  | Imports `javax.servlet`, `javax.persistence` etc.                   | error      |
| `JACKSON3_NAMESPACE` | `com.fasterxml.jackson` → `tools.jackson` (exceto annotations)      | error      |
| `MOCKBEAN_REMOVED`   | `@MockBean`/`@SpyBean` → `@MockitoBean`/`@MockitoSpyBean`           | error      |
| `UNDERTOW_REMOVED`   | Undertow (incompatível com Servlet 6.1)                             | error      |
| `SPOCK_REMOVED`      | Integração com Spock removida                                       | error      |
| `SESSION_REMOVED`    | Spring Session Hazelcast/MongoDB fora do Boot                       | error      |
| `STARTER_RENAMED`    | `web` → `webmvc`, `web-services` → `webservices`, `aop` → `aspectj` | warning    |
| `LAUNCH_SCRIPT`      | Launch script de jar executável removido                            | warning    |
| `PROPERTY_RENAMED`   | Propriedades renomeadas em `application.*`                          | warning    |

## Desenvolvimento

Requer Node.js 24 (veja `.node-version`).

```bash
npm install
npm test            # testes unitários com cobertura
npm run lint        # ESLint + Prettier
npm run bundle      # formata e gera dist/index.js (commite o dist/)
npm run all         # tudo acima, na ordem da CI
```

Para rodar a action localmente, copie `.env.example` para `.env` e execute
`npm run local-action`.

> [!IMPORTANT]
>
> Sempre rode `npm run bundle` e commite o `dist/` antes de abrir um PR. O
> workflow **Check dist/** falha se o bundle commitado estiver desatualizado.

### Fixtures

`__fixtures__/projects/` tem três projetos Spring de mentira usados nos testes e
no dogfood da CI. Cada um traz um `expected.json` com os achados esperados e as
armadilhas que **não** podem gerar falso positivo. Detalhes em
[`__fixtures__/projects/README.md`](./__fixtures__/projects/README.md).

| Fixture            | Build               | Boot  |
| ------------------ | ------------------- | ----- |
| `maven-boot3`      | Maven               | 3.3.5 |
| `gradle-kts-boot3` | Gradle (Kotlin DSL) | 3.4.1 |
| `boot4-ready`      | Gradle (Groovy DSL) | 4.0.0 |

## Roadmap

- **v1.0:** guardrail no diff, suggestions de 1 clique, comentário idempotente
  no PR, 12 regras.
- **v1.1:** `mode: autofix` (abre um PR com as correções seguras) e saída SARIF
  para Code Scanning.
- **v2:** análise por AST, sugestões com IA e painel de prontidão para vários
  repositórios.

## Licença

[MIT](./LICENSE) © Gabriel Oliveira Rossi
