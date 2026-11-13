import * as core from '@actions/core'
import * as github from '@actions/github'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { analyze } from './analyze.js'
import { isPullRequestEvent, readConfig } from './config.js'
import { addedLines, type Octokit } from './report/diff.js'
import { renderReport } from './report/markdown.js'
import { upsertComment } from './report/pr-comment.js'
import { shouldFail } from './rules/engine.js'
import { countByScope, scan } from './scanner.js'
import type { Config, Finding, VersionRef } from './types.js'

/** O GitHub só mostra as primeiras anotações de cada tipo; o resto vai no relatório. */
export const MAX_ANNOTATIONS = 50

/**
 * Ponto de entrada da action.
 *
 * 1. Lê os inputs e o projeto (Dias 1 e 2).
 * 2. Aplica as regras e calcula o score (Dia 3).
 * 3. Decide o que bloqueia (guardrail no diff do PR ou full), publica
 *    anotações, job summary e comentário no PR, define outputs e falha o
 *    job conforme o fail-on (Dia 4).
 */
export async function run(): Promise<void> {
  try {
    const config = readConfig(core.getInput, process.env.GITHUB_EVENT_NAME)
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
    const root = path.resolve(workspace, config.path)

    await assertDirectory(root, config.path)

    core.info('Bootlift — Spring Boot 4 Readiness Check')
    core.info(`  projeto : ${config.path}`)
    core.info(`  modo    : ${config.mode}`)
    core.info(`  fail-on : ${config.failOn}`)

    const files = await scan(root, workspace)
    if (files.length === 0) {
      core.warning(
        `Nenhum arquivo de projeto Java/Spring encontrado em "${config.path}". ` +
          'Confira o input "path".'
      )
      setOutputs(100, 0, 0)
      return
    }

    const counts = countByScope(files)
    core.info(
      `  arquivos: ${files.length} (java ${counts.java} · build ${counts.build} · config ${counts.config})`
    )
    core.startGroup('Arquivos analisados')
    for (const file of files) core.info(`${file.scope.padEnd(6)} ${file.path}`)
    core.endGroup()

    const analysis = analyze(files)
    core.info(`  Spring Boot: ${describe(analysis.project.boot)}`)
    core.info(`  Java       : ${describe(analysis.project.java)}`)
    core.info(`  Gradle     : ${describe(analysis.project.gradle)}`)
    core.info(
      `  score   : ${analysis.score}/100 (${analysis.counts.error} error · ${analysis.counts.warning} warning · ${analysis.counts.info} info)`
    )

    const pr = pullRequest()
    const octokit =
      pr && config.token ? github.getOctokit(config.token) : undefined
    const { blocking, guardrail } = await selectBlocking(
      analysis.findings,
      config,
      pr,
      octokit
    )
    core.info(
      guardrail
        ? `  guardrail: ${blocking.length} achado(s) em linhas adicionadas por este PR`
        : `  full: ${blocking.length} achado(s) podem reprovar o job`
    )

    annotate(blocking)

    const report = renderReport({
      analysis,
      blocking,
      mode: guardrail ? 'guardrail' : 'full',
      pullRequest: guardrail,
      failOn: config.failOn,
      link: linkBuilder(pr?.headSha)
    })

    if (process.env.GITHUB_STEP_SUMMARY) {
      await core.summary.addRaw(report).write()
    }

    if (pr && config.commentOnPr) {
      if (!octokit) {
        core.warning('Sem github-token: o comentário no PR foi pulado.')
      } else {
        try {
          const result = await upsertComment(
            octokit,
            { ...github.context.repo, issue_number: pr.number },
            report
          )
          core.info(
            `  comentário no PR: ${result === 'created' ? 'criado' : 'atualizado'}`
          )
        } catch (error) {
          core.warning(
            `Não foi possível comentar no PR (PRs de fork têm token somente leitura): ${message(error)}`
          )
        }
      }
    }

    setOutputs(analysis.score, blocking.length, analysis.counts.error)

    if (shouldFail(blocking, config.failOn)) {
      core.setFailed(
        `Bootlift: ${blocking.length} achado(s) ${guardrail ? 'novo(s) neste PR ' : ''}bloqueiam o Spring Boot 4 (fail-on: ${config.failOn}, score ${analysis.score}/100).`
      )
    } else {
      core.info('ok')
    }
  } catch (error) {
    core.setFailed(message(error))
  }
}

interface PullRequestInfo {
  number: number
  headSha?: string
}

/** Dados do PR quando o evento é de pull request e o payload tem o número. */
function pullRequest(): PullRequestInfo | undefined {
  if (!isPullRequestEvent(process.env.GITHUB_EVENT_NAME)) return undefined
  const payload = github.context.payload.pull_request
  if (!payload?.number) return undefined
  return { number: payload.number, headSha: payload.head?.sha }
}

/**
 * Guardrail: só os achados em linhas adicionadas pelo PR bloqueiam.
 * Sem PR, sem token ou sem acesso ao diff, cai para o modo full e avisa.
 */
async function selectBlocking(
  findings: Finding[],
  config: Config,
  pr: PullRequestInfo | undefined,
  octokit: Octokit | undefined
): Promise<{ blocking: Finding[]; guardrail: boolean }> {
  if (config.mode === 'full') return { blocking: findings, guardrail: false }

  if (!pr) {
    core.info('  modo guardrail fora de um pull request: usando full')
    return { blocking: findings, guardrail: false }
  }
  if (!octokit) {
    core.warning('Sem github-token para ler o diff do PR: usando o modo full.')
    return { blocking: findings, guardrail: false }
  }
  try {
    const added = await addedLines(octokit, {
      ...github.context.repo,
      pull_number: pr.number
    })
    return {
      blocking: findings.filter((f) => added.get(f.file)?.has(f.line)),
      guardrail: true
    }
  } catch (error) {
    core.warning(
      `Não foi possível ler o diff do PR, usando o modo full: ${message(error)}`
    )
    return { blocking: findings, guardrail: false }
  }
}

/** Anotações por arquivo e linha (aparecem no PR, na aba "Files changed"). */
function annotate(findings: Finding[]): void {
  const by = { error: core.error, warning: core.warning, info: core.notice }
  for (const f of findings.slice(0, MAX_ANNOTATIONS)) {
    by[f.severity](`${f.message}. ${f.fix}.`, {
      title: `Bootlift: ${f.ruleId}`,
      file: f.file,
      startLine: f.line
    })
  }
}

function linkBuilder(
  headSha?: string
): ((f: Finding) => string | undefined) | undefined {
  const sha = headSha ?? github.context.sha
  const { serverUrl } = github.context
  if (!sha || !serverUrl || !process.env.GITHUB_REPOSITORY) return undefined
  const { owner, repo } = github.context.repo
  return (f) =>
    `${serverUrl}/${owner}/${repo}/blob/${sha}/${encodeURI(f.file)}#L${f.line}`
}

function setOutputs(score: number, blocking: number, errors: number): void {
  core.setOutput('score', score)
  core.setOutput('blocking', blocking)
  core.setOutput('errors', errors)
}

/** "3.3.5 (pom.xml:10)" ou "—" quando nada foi encontrado. */
export function describe(refs: VersionRef[]): string {
  if (refs.length === 0) return '—'
  return refs.map((r) => `${r.value} (${r.file}:${r.line})`).join(', ')
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function assertDirectory(absolute: string, input: string): Promise<void> {
  const info = await stat(absolute).catch(() => undefined)
  if (!info?.isDirectory()) {
    throw new Error(`Diretório do projeto não encontrado: "${input}"`)
  }
}
