# Contribuindo com o Bootlift

Obrigado pelo interesse em melhorar o Bootlift! 🚀 Toda ajuda conta: relatar um
falso positivo, sugerir uma regra, melhorar a documentação ou mandar código.

Este guia explica como fazer cada uma dessas coisas. Se ficar alguma dúvida,
abra uma [issue](https://github.com/GabrielRossi01/bootlift/issues) e pergunte.

## Sumário

- [Formas de contribuir](#formas-de-contribuir)
- [Ambiente de desenvolvimento](#ambiente-de-desenvolvimento)
- [Como o projeto está organizado](#como-o-projeto-está-organizado)
- [Criando ou alterando uma regra](#criando-ou-alterando-uma-regra)
- [Testes e fixtures](#testes-e-fixtures)
- [Abrindo um pull request](#abrindo-um-pull-request)
- [Padrões do projeto](#padrões-do-projeto)

## Formas de contribuir

### 🐞 Relatar um falso positivo (ou negativo)

É a contribuição mais valiosa: cada caso real deixa as regras mais precisas.
Abra uma issue com:

- a **regra** envolvida (por exemplo, `JAKARTA_NAMESPACE`);
- a **linha** que gerou (ou deveria ter gerado) o achado, copiada do arquivo;
- o **tipo de arquivo** (`pom.xml`, `build.gradle.kts`, `application.yml`,
  `.java`...);
- o que você **esperava** que acontecesse.

Não precisa mandar o projeto inteiro: a linha e o nome do arquivo bastam.

### 💡 Sugerir uma regra nova

O Spring Boot 4 tem mais mudanças do que as 12 regras atuais cobrem. Para propor
uma nova, abra uma issue com:

- a **mudança** do Boot 4 (de preferência com o link da seção no
  [guia oficial de migração](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
  ou nas release notes);
- um **exemplo** de código antigo e de como ele fica depois de migrado;
- a **severidade** que você sugere (veja a tabela em
  [Severidades](#severidades)).

### 📝 Melhorar a documentação

Correções no README, neste guia, em mensagens das regras ou em comentários do
código são muito bem-vindas, inclusive as pequenas. Para elas, pode abrir o PR
direto, sem issue.

### 🛠️ Mandar código

Para mudanças maiores (regra nova, input novo, mudança no score), **abra uma
issue antes** para combinarmos a abordagem. Assim ninguém perde tempo com um PR
que precisaria ser refeito.

Quer começar por algo menor? Procure issues com o label `good first issue`.

## Ambiente de desenvolvimento

Você precisa do **Node.js 24** (a versão exata está em `.node-version`) e do
Git. Não é preciso ter Java instalado: o Bootlift só lê os arquivos do projeto,
sem compilar.

1. Faça um **fork** do repositório no GitHub e clone o seu fork:

   ```bash
   git clone https://github.com/<seu-usuario>/bootlift.git
   cd bootlift
   npm ci
   ```

2. Rode os testes para confirmar que está tudo certo:

   ```bash
   npm test
   ```

3. Crie uma branch para a sua mudança:

   ```bash
   git checkout -b fix/jakarta-annotation-falso-positivo
   ```

Os comandos funcionam igual no Linux, no macOS e no Windows (PowerShell).

### Scripts úteis

| Comando                | O que faz                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `npm test`             | Roda todos os testes com cobertura.                          |
| `npm run lint`         | Roda o ESLint.                                               |
| `npm run format:write` | Formata o código com o Prettier.                             |
| `npm run format:check` | Confere a formatação, como a CI faz.                         |
| `npm run bundle`       | Formata e gera o `dist/index.js` (o que a action executa).   |
| `npm run local-action` | Executa a action localmente usando as variáveis do `.env`.   |
| `npm run all`          | Formata, roda lint, testes, badge de cobertura e o `bundle`. |

### Rodando a action na sua máquina

Copie o `.env.example` para `.env`, ajuste o `INPUT_PATH` para uma das fixtures
(ou para um projeto Spring seu) e rode:

```bash
npm run local-action
```

A saída mostra os arquivos lidos, as versões detectadas, os achados e o score,
do mesmo jeito que aparece no log do GitHub Actions.

## Como o projeto está organizado

```text
src/
├── main.ts            # Fluxo da action: inputs → scan → regras → relatórios
├── config.ts          # Leitura e validação dos inputs do action.yml
├── scanner.ts         # Percorre o projeto e classifica os arquivos
├── project.ts         # Detecta build tool e versões de Boot, Java e Gradle
├── analyze.ts         # Junta as regras e calcula o score
├── rules/
│   ├── catalog.ts            # ⭐ Regras de linha (regex): a maioria mora aqui
│   ├── engine.ts             # Aplica o catálogo, score e fail-on
│   ├── versions.ts           # BOOT_VERSION, JAVA_BASELINE, GRADLE_VERSION
│   ├── properties.ts         # PROPERTY_RENAMED (YAML e .properties)
│   └── renamed-properties.ts # Lista de propriedades renomeadas
└── report/
    ├── diff.ts        # Linhas adicionadas pelo PR (modo guardrail)
    ├── markdown.ts    # Relatório do job summary e do comentário
    ├── pr-comment.ts  # Comentário único no PR, atualizado a cada push
    └── review.ts      # Sugestões de 1 clique
```

Os testes ficam em `__tests__/` e os projetos de exemplo em
`__fixtures__/projects/`.

## Criando ou alterando uma regra

A maioria das regras é só um objeto em `src/rules/catalog.ts`:

```ts
{
  id: 'UNDERTOW_REMOVED',
  severity: 'error',
  scope: 'build', // 'build' | 'config' | 'java'
  pattern: '\\bspring-boot-starter-undertow\\b',
  message: 'Undertow foi removido: ainda não é compatível com Servlet 6.1',
  fix: 'Use o Tomcat (padrão) ou o Jetty (spring-boot-starter-jetty)',
  docs: MIGRATION_GUIDE
}
```

Passo a passo:

1. **Registre o id** em `RULE_IDS`, no `src/types.ts`. O TypeScript passa a
   conferir o nome em todo o projeto.
2. **Acrescente a regra** no `catalog.ts`, com `message` explicando o problema e
   `fix` dizendo o que fazer. Os textos aparecem para o usuário, então escreva
   em português claro e sem jargão desnecessário.
3. **`replace` só quando a correção é certa.** Se a regra tiver `replace`, cada
   achado vira uma sugestão de 1 clique no PR. Use apenas quando a troca for
   mecânica e sempre correta (como `javax.servlet` → `jakarta.servlet`). Na
   dúvida, deixe sem `replace`: um relatório sem sugestão é melhor que uma
   sugestão que quebra o build.
4. **Escreva os testes** em `__tests__/rules.test.ts`: pelo menos um caso que
   **deve** disparar e um parecido que **não deve** (veja a seção abaixo).
5. **Atualize a tabela de regras** no `README.md` e o `CHANGELOG.md`.

Regras de versão e de propriedades têm lógica própria em `versions.ts` e
`properties.ts`. A lista de propriedades renomeadas vem da receita
`spring-boot-40-properties` do
[OpenRewrite](https://github.com/openrewrite/rewrite-spring) (Apache-2.0); ao
atualizá-la, mantenha o comentário com a origem.

### Severidades

| Severidade | Quando usar                                                          | Peso no score |
| ---------- | -------------------------------------------------------------------- | ------------- |
| `error`    | O projeto **não compila ou não sobe** no Boot 4 sem corrigir.        | 15            |
| `warning`  | Funciona hoje, mas está obsoleto, renomeado ou vai quebrar em breve. | 5             |
| `info`     | Recomendação: algo que facilita a migração, sem bloquear nada.       | 1             |

Mudar a severidade de uma regra existente altera o score de todos os usuários,
então discuta numa issue antes.

### Evitando falsos positivos

O motor analisa linha a linha, com regex. Algumas dicas:

- Use `\\b` e lookaheads para não pegar nomes parecidos (por exemplo,
  `spring-boot-starter-web` não pode disparar em `spring-boot-starter-webflux`).
- Linhas de comentário (`//`, `/* */`, `#`, `<!-- -->`) já são ignoradas pelo
  motor; não precisa tratar isso na regra.
- Pense em pacotes do JDK com nome parecido: `javax.sql` e `javax.crypto` não
  migram para `jakarta`.

## Testes e fixtures

Todo PR que mexe em regras precisa de testes. Há dois níveis:

- **Testes unitários** (`__tests__/rules.test.ts`): uma linha de entrada e o
  achado esperado. Adicione casos às tabelas `it.each` de positivos e negativos.
- **Fixtures** (`__fixtures__/projects/`): três projetos Spring de mentira, cada
  um com um `expected.json` que lista os achados esperados (`expected`) e as
  armadilhas que não podem gerar achado (`traps`). Os testes comparam o
  resultado com esse arquivo **exatamente**.

Se você acrescentar uma linha numa fixture, os números de linha abaixo dela
mudam: atualize o `expected.json`. O teste `__tests__/fixtures.test.ts` avisa
quando `line` e `match` deixam de bater. Mais detalhes em
[`__fixtures__/projects/README.md`](./__fixtures__/projects/README.md).

A cobertura atual passa de 95%; procure manter assim.

## Abrindo um pull request

Antes de abrir o PR, rode:

```bash
npm run format:write
npm run lint
npm test
npm run bundle
```

> [!IMPORTANT]
>
> **Commite o `dist/`.** O GitHub Actions executa o `dist/index.js` diretamente,
> então qualquer mudança em `src/` precisa vir acompanhada do bundle novo. O
> workflow **Check dist/** reprova o PR se o `dist/` estiver desatualizado.

Checklist do PR:

- [ ] A descrição explica **o quê** mudou e **por quê** (e linka a issue, se
      houver).
- [ ] Há testes para o comportamento novo ou para o bug corrigido.
- [ ] `npm test`, `npm run lint` e `npm run format:check` passam.
- [ ] O `dist/` foi regerado com `npm run bundle` e commitado.
- [ ] README e `CHANGELOG.md` foram atualizados, se a mudança for visível para
      quem usa a action.

A CI roda os testes, o lint, a formatação e executa a própria action nas
fixtures (dogfood). Com tudo verde, o PR entra na fila de revisão. Pode ser que
eu peça ajustes; isso faz parte do processo e não tem nada de pessoal. 🙂

## Padrões do projeto

- **Commits** seguem o
  [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em
  português: `feat: regra para spring-boot-starter-jersey`,
  `fix: falso positivo em javax.annotation.Nonnull`,
  `docs: explica o modo guardrail`.
- **Branches** com prefixo do tipo: `feat/...`, `fix/...`, `docs/...`.
- **Código** em TypeScript estrito, formatado pelo Prettier e validado pelo
  ESLint. Nomes de variáveis e funções em inglês; comentários, mensagens das
  regras e documentação em português.
- **Versionamento** segue o [SemVer](https://semver.org/lang/pt-BR/): regra nova
  ou input novo é _minor_ (v1.1.0); correção é _patch_ (v1.0.1); mudança que
  quebra workflows existentes é _major_ (v2.0.0). As releases são feitas pelo
  mantenedor.

## Conduta

Seja respeitoso e paciente com todos, em issues, PRs e comentários. Críticas são
sobre o código, nunca sobre a pessoa. Comportamento abusivo não é tolerado.

## Licença

Ao contribuir, você concorda que a sua contribuição será licenciada sob a
[licença MIT](./LICENSE) do projeto.
