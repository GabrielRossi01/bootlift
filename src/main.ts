import * as core from '@actions/core'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { readConfig } from './config.js'

/**
 * Ponto de entrada da action.
 *
 * Dia 1 (fundação): valida inputs e o diretório do projeto e loga a
 * configuração. Scanner (Dia 2), regras (Dia 3) e relatórios (Dia 4) entram
 * aqui depois, sem mudar o contrato do action.yml.
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
    core.info('ok — fundação pronta (análise chega nos Dias 2 e 3)')
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

async function assertDirectory(absolute: string, input: string): Promise<void> {
  const info = await stat(absolute).catch(() => undefined)
  if (!info?.isDirectory()) {
    throw new Error(`Diretório do projeto não encontrado: "${input}"`)
  }
}
