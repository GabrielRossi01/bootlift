/**
 * Testes do relatório (Dia 4): diff do PR, Markdown e comentário idempotente.
 */
import type { Analysis } from '../src/analyze.js'
import { addedLines, parsePatch, type Octokit } from '../src/report/diff.js'
import {
  MARKER,
  MAX_ROWS,
  renderReport,
  scoreBar
} from '../src/report/markdown.js'
import { upsertComment } from '../src/report/pr-comment.js'
import type { Finding } from '../src/types.js'
import { fakeOctokit } from '../__fixtures__/github.js'

const asOctokit = (o: unknown) => o as Octokit

describe('parsePatch', () => {
  it('devolve só as linhas adicionadas, no lado novo do arquivo', () => {
    const patch = [
      '@@ -1,4 +1,5 @@',
      ' package a;', //           1
      '-import javax.x.A;', //     (removida)
      '+import jakarta.x.A;', //   2
      '+import jakarta.x.B;', //   3
      ' ', //                     4
      ' class A {}', //           5
      '@@ -20,2 +21,3 @@',
      ' a', //                    21
      '+b', //                    22
      ' c' //                     23
    ].join('\n')
    expect([...parsePatch(patch)]).toEqual([2, 3, 22])
  })

  it('patch vazio não adiciona nada', () => {
    expect(parsePatch('').size).toBe(0)
  })

  it('addedLines junta as páginas e pula arquivos sem patch', async () => {
    const { octokit } = fakeOctokit({
      files: [
        { filename: 'a/A.java', patch: '@@ -0,0 +1,2 @@\n+x\n+y' },
        { filename: 'big.bin' }
      ]
    })
    const added = await addedLines(asOctokit(octokit), {
      owner: 'o',
      repo: 'r',
      pull_number: 1
    })
    expect([...added.keys()]).toEqual(['a/A.java'])
    expect([...added.get('a/A.java')!]).toEqual([1, 2])
  })
})

const finding = (
  n: number,
  severity: Finding['severity'] = 'error'
): Finding => ({
  ruleId: 'JAKARTA_NAMESPACE',
  severity,
  file: `src/A${n}.java`,
  line: n,
  message: 'Problema | com barra',
  fix: 'Corrija',
  docs: 'https://example.com/guia'
})

const analysis = (findings: Finding[], score = 70): Analysis => ({
  findings,
  score,
  counts: { error: findings.length, warning: 0, info: 0 },
  project: {
    buildTools: ['maven'],
    boot: [
      { value: '3.3.5', file: 'pom.xml', line: 10, source: 'maven-parent' }
    ],
    java: [
      { value: '17', file: 'pom.xml', line: 20, source: 'maven-java.version' }
    ],
    gradle: []
  }
})

describe('renderReport', () => {
  it('começa com o marcador e mostra score, barra e versões', () => {
    const md = renderReport({
      analysis: analysis([finding(1)]),
      blocking: [finding(1)],
      mode: 'full',
      pullRequest: false,
      failOn: 'error'
    })
    expect(md.startsWith(MARKER)).toBe(true)
    expect(md).toContain('Readiness: **70/100**')
    expect(md).toContain('`▰▰▰▰▰▰▰▱▱▱`')
    expect(md).toContain('| 3.3.5 | 17 | — | maven |')
    expect(md).toContain('Problema \\| com barra')
    expect(md).toContain('([guia](https://example.com/guia))')
  })

  it('no guardrail separa os novos dos já existentes', () => {
    const all = [finding(1), finding(2), finding(3)]
    const md = renderReport({
      analysis: analysis(all),
      blocking: [all[1]],
      mode: 'guardrail',
      pullRequest: true,
      failOn: 'error',
      link: (f) => `https://github.com/o/r/blob/sha/${f.file}#L${f.line}`
    })
    expect(md).toContain('este PR adiciona 1 problema novo')
    expect(md).toContain('### Novos neste PR')
    expect(md).toContain('Já existentes no repositório (2)')
    expect(md).toContain(
      '[`src/A2.java:2`](https://github.com/o/r/blob/sha/src/A2.java#L2)'
    )
  })

  it('no guardrail avisa quantas correções têm sugestão de 1 clique', () => {
    const base = {
      analysis: analysis([finding(1)]),
      blocking: [finding(1)],
      mode: 'guardrail' as const,
      pullRequest: true,
      failOn: 'error' as const
    }
    expect(renderReport({ ...base, suggestions: 1 })).toContain(
      '💡 1 correção pode ser aplicada em 1 clique'
    )
    expect(renderReport({ ...base, suggestions: 3 })).toContain(
      '💡 3 correções podem ser aplicadas em 1 clique'
    )
    expect(renderReport({ ...base, suggestions: 0 })).not.toContain('💡')
    expect(
      renderReport({
        ...base,
        mode: 'full',
        pullRequest: false,
        suggestions: 3
      })
    ).not.toContain('💡')
  })

  it('no guardrail sem problemas novos deixa isso claro', () => {
    const md = renderReport({
      analysis: analysis([finding(1)]),
      blocking: [],
      mode: 'guardrail',
      pullRequest: true,
      failOn: 'error'
    })
    expect(md).toContain('este PR não adiciona nenhum problema novo')
    expect(md).not.toContain('### Novos neste PR')
  })

  it('projeto sem achados ganha a mensagem de pronto', () => {
    const md = renderReport({
      analysis: analysis([], 100),
      blocking: [],
      mode: 'full',
      pullRequest: false,
      failOn: 'error'
    })
    expect(md).toContain('pronto para o Spring Boot 4')
    expect(md).not.toContain('| Regra |')
  })

  it(`corta a tabela em ${MAX_ROWS} linhas`, () => {
    const many = Array.from({ length: MAX_ROWS + 5 }, (_, i) => finding(i + 1))
    const md = renderReport({
      analysis: analysis(many),
      blocking: many,
      mode: 'full',
      pullRequest: false,
      failOn: 'error'
    })
    expect(md).toContain('… e mais 5')
  })

  it('scoreBar arredonda para dezenas', () => {
    expect(scoreBar(100)).toBe('▰'.repeat(10))
    expect(scoreBar(0)).toBe('▱'.repeat(10))
    expect(scoreBar(34)).toBe('▰▰▰▱▱▱▱▱▱▱')
  })
})

describe('upsertComment', () => {
  const issue = { owner: 'o', repo: 'r', issue_number: 7 }

  it('cria quando ainda não há comentário do Bootlift', async () => {
    const { octokit, calls } = fakeOctokit({
      comments: [{ id: 1, body: 'LGTM' }]
    })
    const result = await upsertComment(
      asOctokit(octokit),
      issue,
      `${MARKER}\nnovo`
    )
    expect(result).toBe('created')
    expect(calls.created).toEqual([`${MARKER}\nnovo`])
  })

  it('atualiza o comentário que tem o marcador', async () => {
    const { octokit, calls } = fakeOctokit({
      comments: [{ id: 5, body: `${MARKER}\nvelho` }]
    })
    const result = await upsertComment(
      asOctokit(octokit),
      issue,
      `${MARKER}\nnovo`
    )
    expect(result).toBe('updated')
    expect(calls.updated).toEqual([{ id: 5, body: `${MARKER}\nnovo` }])
  })
})
