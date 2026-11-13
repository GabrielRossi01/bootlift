# Changelog

Todas as mudanças relevantes do Bootlift. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem
o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.1] - 2026-11-13

### Corrigido

- O relatório escapa a barra invertida (`\`) antes do `|`. Antes, um nome de
  arquivo ou texto com `\|` quebrava as colunas da tabela no comentário do PR e
  no job summary.
- Os padrões das regras de starters renomeados escapam todos os caracteres
  especiais de regex, não só o `-` (nova função `escapeRegExp`).

Os dois itens resolvem os alertas `js/incomplete-sanitization` do CodeQL.

### Documentação

- Guia de contribuição ([CONTRIBUTING.md](./CONTRIBUTING.md)).
- Formulários de issue (falso positivo, regra nova e bug) e template de pull
  request.

## [1.0.0] - 2026-11-13

Primeira versão pública, no GitHub Marketplace.

### Adicionado

- **Scanner** de projetos Maven, Gradle (Groovy e Kotlin DSL) e version catalog,
  de `application.*` (YAML e `.properties`, com perfis) e de código Java/Kotlin,
  sem compilar e sem JDK no runner.
- **12 regras** baseadas no guia oficial de migração para o Spring Boot 4:
  `BOOT_VERSION`, `JAVA_BASELINE`, `GRADLE_VERSION`, `JAKARTA_NAMESPACE`,
  `JACKSON3_NAMESPACE`, `MOCKBEAN_REMOVED`, `UNDERTOW_REMOVED`, `SPOCK_REMOVED`,
  `SESSION_REMOVED`, `STARTER_RENAMED`, `LAUNCH_SCRIPT` e `PROPERTY_RENAMED` (96
  propriedades renomeadas, com relaxed binding).
- **Score de prontidão** de 0 a 100: cada regra pesa uma vez pela severidade,
  mais 1 por ocorrência extra (até 10 por regra).
- **Modo guardrail:** em PRs, só as linhas adicionadas podem reprovar o job. Se
  o diff não puder ser lido, a action avisa e usa o modo `full`.
- **Relatório** no job summary, anotações nas linhas e um comentário no PR que é
  atualizado a cada push, em vez de duplicado.
- **Sugestões de 1 clique** nas linhas novas do PR, sem repetir as que já foram
  publicadas.
- Inputs `path`, `mode`, `fail-on`, `comment-on-pr`, `suggestions` e
  `github-token`; outputs `score`, `blocking` e `errors`.

[1.0.1]: https://github.com/GabrielRossi01/bootlift/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/GabrielRossi01/bootlift/releases/tag/v1.0.0
