/**
 * The every-step Maestro sweep's Node side (`mobile/maestro/run.sh --sweep`,
 * `mobile/maestro/README.md`). Three subcommands, all run by `run.sh`:
 *
 *   tsx scripts/maestroSweep.ts steps [--only <step>]
 *     One line per step, in sweep order (core's `QA_STEPS`: Number Garden,
 *     then Word Song): `<step> <world> <position> <xfail 0|1>`. Checks the
 *     expected-fail list and `--only` against the steps.
 *
 *   tsx scripts/maestroSweep.ts serve --port <n> --log <file>
 *     The sweep's `/api/claude` on 127.0.0.1:<n> (`maestroSweepApi.ts`:
 *     the committed canon through the production handler, no credentials,
 *     no outbound fetch). Appends one JSON record per request to <file>.
 *
 *   tsx scripts/maestroSweep.ts verdict --step <s> --world <w> --xfail 0|1
 *       --flow-exit <n> --metro <file> --api <file>
 *     Prints `<VERDICT>\t<detail>` for one step (`maestroSweepVerdict.ts`).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  EXPECTED_FAIL_FILE,
  classifyStep,
  parseApiLog,
  parseExpectedFail,
  type SweepApiRecord,
  type SweepWorld,
} from './maestroSweepVerdict.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function die(message: string): never {
  console.error(`maestroSweep: ${message}`)
  process.exit(2)
}

async function steps(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { only: { type: 'string' } },
  })
  const { QA_STEPS } = await import('@marian/core/debug/stepProgress')
  const names = QA_STEPS.map((s) => s.node)
  const xfail = parseExpectedFail(
    readFileSync(join(ROOT, EXPECTED_FAIL_FILE), 'utf8'),
    names,
  )
  const only = values.only
  if (only !== undefined && !names.includes(only as (typeof names)[number])) {
    die(`"${only}" is not a step. Steps: ${names.join(', ')}`)
  }
  for (const s of QA_STEPS) {
    if (only !== undefined && s.node !== only) continue
    console.log(
      `${s.node} ${s.world} ${s.position} ${xfail.has(s.node) ? 1 : 0}`,
    )
  }
}

async function serve(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { port: { type: 'string' }, log: { type: 'string' } },
  })
  const port = Number(values.port)
  const logFile = values.log
  if (!Number.isInteger(port) || port <= 0) die('serve needs --port <n>')
  if (!logFile) die('serve needs --log <file>')

  const {
    PLACEHOLDER_ANTHROPIC_KEY,
    assertNoCredentials,
    blockOutboundFetch,
    createSweepApi,
  } = await import('./maestroSweepApi.ts')
  try {
    assertNoCredentials(process.env)
  } catch (err) {
    die(err instanceof Error ? err.message : String(err))
  }
  process.env.ANTHROPIC_API_KEY = PLACEHOLDER_ANTHROPIC_KEY
  blockOutboundFetch((url) =>
    console.error(`[sweep-api] OUTBOUND BLOCKED ${url}`),
  )

  writeFileSync(logFile, '')
  const api = createSweepApi({
    record: (r: SweepApiRecord) => {
      appendFileSync(logFile, `${JSON.stringify(r)}\n`)
      console.log(
        `[sweep-api] ${r.kind} ${r.track ?? '-'} ${r.focusNode ?? '-'} -> ${r.status} ${r.source}`,
      )
    },
  })

  const server = createServer((req, res) => {
    if (req.url === '/__sweep/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined) continue
        headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      const method = req.method ?? 'GET'
      const request = new Request(`http://127.0.0.1:${port}${req.url ?? '/'}`, {
        method,
        headers,
        body:
          method === 'GET' || method === 'HEAD'
            ? undefined
            : Buffer.concat(chunks),
      })
      api(request)
        .then(async (response) => {
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(Buffer.from(await response.arrayBuffer()))
        })
        .catch((err: unknown) => {
          console.error('[sweep-api] handler threw', err)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('sweep API error')
        })
    })
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(
      `[sweep-api] listening on http://127.0.0.1:${port} (log: ${logFile})`,
    )
  })
}

function verdict(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      step: { type: 'string' },
      world: { type: 'string' },
      xfail: { type: 'string' },
      'flow-exit': { type: 'string' },
      metro: { type: 'string' },
      api: { type: 'string' },
    },
  })
  const { step, world, xfail, metro, api } = values
  const flowExit = values['flow-exit']
  if (!step || !metro || !api || flowExit === undefined) {
    die('verdict needs --step, --world, --xfail, --flow-exit, --metro, --api')
  }
  if (world !== 'math' && world !== 'word-song') die(`unknown world "${world}"`)
  const result = classifyStep({
    node: step,
    world: world as SweepWorld,
    expectedFail: xfail === '1',
    flowPassed: flowExit === '0',
    metroLog: readFileSync(metro, 'utf8'),
    apiRecords: parseApiLog(readFileSync(api, 'utf8')),
  })
  console.log(`${result.verdict}\t${result.detail}`)
}

const [command, ...rest] = process.argv.slice(2)
if (command === 'steps') await steps(rest)
else if (command === 'serve') await serve(rest)
else if (command === 'verdict') verdict(rest)
else die('usage: maestroSweep.ts steps | serve | verdict (see the file header)')
