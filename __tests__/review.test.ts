/**
 * Testes das sugestões de 1 clique (Dia 5).
 */
import type { Octokit } from '../src/report/diff.js'
import {
  MAX_SUGGESTIONS,
  postSuggestions,
  SUGGESTION_MARKER,
  suggestable,
  suggestionBody
} from '../src/report/review.js'
import type { Finding } from '../src/types.js'
import { fakeOctokit } from '../__fixtures__/github.js'

const asOctokit = (o: unknown) => o as Octokit
const ref = { owner: 'o', repo: 'r', pull_number: 7, commit_id: 'abc' }

function finding(line: number, extra: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'MOCKBEAN_REMOVED',
    severity: 'error',
    file: 'src/test/java/AppTest.java',
    line,
    message: '@MockBean foi removido no Spring Boot 4',
    fix: 'Use @MockitoBean',
    docs: 'https://example.com/guia',
    suggestion: '    @MockitoBean',
    ...extra
  }
}

describe('suggestable', () => {
  it('fica só com achados que têm correção, um por linha', () => {
    const result = suggestable([
      finding(1),
      finding(1, { ruleId: 'JAKARTA_NAMESPACE', suggestion: 'outra' }),
      finding(2, { suggestion: undefined }),
      finding(3)
    ])
    expect(result.map((f) => [f.line, f.ruleId])).toEqual([
      [1, 'MOCKBEAN_REMOVED'],
      [3, 'MOCKBEAN_REMOVED']
    ])
  })

  it('aceita sugestão vazia (apagar a linha)', () => {
    expect(suggestable([finding(1, { suggestion: '' })])).toHaveLength(1)
  })
})

describe('suggestionBody', () => {
  it('traz regra, mensagem, bloco suggestion, correção e marcador', () => {
    expect(suggestionBody(finding(1))).toBe(
      [
        '**Bootlift · `MOCKBEAN_REMOVED`**: @MockBean foi removido no Spring Boot 4.',
        '',
        '```suggestion',
        '    @MockitoBean',
        '```',
        '',
        '<sub>Use @MockitoBean · [guia de migração](https://example.com/guia)</sub>',
        SUGGESTION_MARKER
      ].join('\n')
    )
  })

  it('aumenta a cerca quando a linha já tem crases', () => {
    const body = suggestionBody(finding(1, { suggestion: 'a ``` b' }))
    expect(body).toContain('````suggestion\na ``` b\n````')
  })
})

describe('postSuggestions', () => {
  it('publica um review COMMENT com uma sugestão por linha', async () => {
    const { octokit, calls } = fakeOctokit({})
    const result = await postSuggestions(asOctokit(octokit), ref, [
      finding(10),
      finding(20)
    ])

    expect(result).toEqual({ posted: 2, skipped: 0 })
    expect(calls.reviews).toHaveLength(1)
    const [review] = calls.reviews
    expect(review).toMatchObject({ commit_id: 'abc', event: 'COMMENT' })
    expect(review.body).toContain(
      '2 correções prontas para aplicar em 1 clique'
    )
    expect(review.comments).toEqual([
      expect.objectContaining({
        path: 'src/test/java/AppTest.java',
        line: 10,
        side: 'RIGHT'
      }),
      expect.objectContaining({ line: 20 })
    ])
  })

  it('não chama a API quando não há o que sugerir', async () => {
    const { octokit, calls } = fakeOctokit({})
    const result = await postSuggestions(asOctokit(octokit), ref, [
      finding(1, { suggestion: undefined })
    ])
    expect(result).toEqual({ posted: 0, skipped: 0 })
    expect(octokit.rest.pulls.listReviewComments).not.toHaveBeenCalled()
    expect(calls.reviews).toHaveLength(0)
  })

  it('pula sugestões já publicadas num push anterior', async () => {
    const { octokit, calls } = fakeOctokit({
      reviewComments: [
        {
          path: 'src/test/java/AppTest.java',
          line: 99,
          body: suggestionBody(finding(10))
        },
        { path: 'outro/Arquivo.java', body: suggestionBody(finding(20)) }
      ]
    })
    const result = await postSuggestions(asOctokit(octokit), ref, [
      finding(10),
      finding(30, { suggestion: '    @MockitoSpyBean' })
    ])

    // finding(10) já existe no mesmo arquivo (a linha pode ter mudado): pula.
    expect(result).toEqual({ posted: 1, skipped: 1 })
    expect(calls.reviews[0].comments.map((c) => c.line)).toEqual([30])
  })

  it('não publica nada se todas já estavam no PR', async () => {
    const { octokit, calls } = fakeOctokit({
      reviewComments: [
        {
          path: 'src/test/java/AppTest.java',
          body: suggestionBody(finding(10))
        }
      ]
    })
    const result = await postSuggestions(asOctokit(octokit), ref, [finding(10)])
    expect(result).toEqual({ posted: 0, skipped: 1 })
    expect(calls.reviews).toHaveLength(0)
  })

  it(`limita o review a ${MAX_SUGGESTIONS} sugestões e avisa do resto`, async () => {
    const { octokit, calls } = fakeOctokit({})
    const many = Array.from({ length: MAX_SUGGESTIONS + 3 }, (_, i) =>
      finding(i + 1, { suggestion: `linha ${i}` })
    )
    const result = await postSuggestions(asOctokit(octokit), ref, many)

    expect(result.posted).toBe(MAX_SUGGESTIONS)
    expect(calls.reviews[0].comments).toHaveLength(MAX_SUGGESTIONS)
    expect(calls.reviews[0].body).toContain('Mais 3 aparecem no próximo push')
  })

  it('sem commit_id, deixa o GitHub usar o head atual', async () => {
    const { octokit, calls } = fakeOctokit({})
    await postSuggestions(
      asOctokit(octokit),
      { owner: 'o', repo: 'r', pull_number: 1 },
      [finding(1)]
    )
    expect(calls.reviews[0]).not.toHaveProperty('commit_id')
    expect(calls.reviews[0].body).toContain('1 correção pronta')
  })
})
