import * as core from '@actions/core'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { readConfig } from './config.js'
import { detectProject } from './project.js'
import { countByScope, scan } from './scanner.js'
import type { VersionRef } from './types.js'

/**
 * Ponto de entrada da action.
 *
 * Dia 1: valida inputs e o diretório do projeto.
 * Dia 2: lê os arquivos do projeto e descobre as versões de Boot, Java e
 * Gradle. Regras (Dia 3) e relatórios (Dia 4) entram aqui depois, sem mudar
 * o contrato do action.yml.
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
    core.info(`  comentar no PR: ${config.commentOnPr ? 'sim' : 'não'}`)

    const files = await scan(root, workspace)
    if (files.length === 0) {
      core.warning(
        `Nenhum arquivo de projeto Java/Spring encontrado em "${config.path}". ` +
          'Confira o input "path".'
      )
      return
    }

    const counts = countByScope(files)
    const project = detectProject(files)
    core.info(
      `  arquivos: ${files.length} (java ${counts.java} · build ${counts.build} · config ${counts.config})`
    )
    core.info(`  build   : ${project.buildTools.join(', ') || '—'}`)
    core.info(`  Spring Boot: ${describe(project.boot)}`)
    core.info(`  Java       : ${describe(project.java)}`)
    core.info(`  Gradle     : ${describe(project.gradle)}`)

    core.startGroup('Arquivos analisados')
    for (const file of files) core.info(`${file.scope.padEnd(6)} ${file.path}`)
    core.endGroup()

    core.info('ok — scanner pronto (regras chegam no Dia 3)')
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

/** "3.3.5 (pom.xml:10)" ou "—" quando nada foi encontrado. */
export function describe(refs: VersionRef[]): string {
  if (refs.length === 0) return '—'
  return refs.map((r) => `${r.value} (${r.file}:${r.line})`).join(', ')
}

async function assertDirectory(absolute: string, input: string): Promise<void> {
  const info = await stat(absolute).catch(() => undefined)
  if (!info?.isDirectory()) {
    throw new Error(`Diretório do projeto não encontrado: "${input}"`)
  }
}
