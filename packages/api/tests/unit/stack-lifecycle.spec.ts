import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  E2E_OWN_STACK_ENV,
  composeFiles,
  shouldOwnStack
} from '../e2e/stack-lifecycle'

describe('shouldOwnStack', () => {
  const cases: Array<[string, NodeJS.ProcessEnv, boolean]> = [
    ['owns the stack by default', {}, true],
    [
      'owns the stack on an explicit opt-in',
      { [E2E_OWN_STACK_ENV]: '1' },
      true
    ],
    ['skips on an explicit opt-out', { [E2E_OWN_STACK_ENV]: '0' }, false]
  ]

  it.each(cases)('%s', (_name, env, expected) => {
    expect(shouldOwnStack(env)).toBe(expected)
  })
})

describe('composeFiles', () => {
  it('returns the base file alone by default', () => {
    const files = composeFiles({})
    expect(files.map((file) => basename(file))).toEqual([
      'docker-compose.test.yaml'
    ])
  })

  it('appends overlays in order, resolving relative paths', () => {
    const files = composeFiles({
      E2E_COMPOSE_FILES: 'docker-compose.test.mollie.yaml'
    })
    expect(files.map((file) => basename(file))).toEqual([
      'docker-compose.test.yaml',
      'docker-compose.test.mollie.yaml'
    ])
  })

  it('splits colon- and comma-separated overlays and keeps absolute paths', () => {
    const files = composeFiles({
      E2E_COMPOSE_FILES: '/tmp/one.yaml:two.yaml,three.yaml'
    })
    expect(files.map((file) => basename(file))).toEqual([
      'docker-compose.test.yaml',
      'one.yaml',
      'two.yaml',
      'three.yaml'
    ])
  })
})
