import { timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { describe, expect, test, vi } from 'vitest'
import { tokensMatch } from '../../src/utils/tokensMatch'

describe('tokensMatch', () => {
  test('uses Node native comparison when the Workers extension is absent', async () => {
    const nodeCrypto = process.getBuiltinModule(
      'node:crypto'
    ) as typeof import('node:crypto')
    const compare = vi.spyOn(nodeCrypto, 'timingSafeEqual')

    try {
      expect(await tokensMatch('short', 'a-different-length-token')).toBe(false)
      expect(compare).toHaveBeenCalledOnce()

      const [providedHash, expectedHash] = compare.mock.calls[0]!
      expect(providedHash.byteLength).toBe(32)
      expect(expectedHash.byteLength).toBe(32)
      expect(await tokensMatch('matching-token', 'matching-token')).toBe(true)
    } finally {
      compare.mockRestore()
    }
  })

  test('prefers the Workers timing-safe comparison when available', async () => {
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean
    }
    const original = Object.getOwnPropertyDescriptor(subtle, 'timingSafeEqual')
    const compare = vi.fn(timingSafeEqual)
    Object.defineProperty(subtle, 'timingSafeEqual', {
      configurable: true,
      value: compare,
    })

    try {
      expect(await tokensMatch('short', 'different')).toBe(false)
      expect(await tokensMatch('same', 'same')).toBe(true)
      expect(compare).toHaveBeenCalledTimes(2)
    } finally {
      if (original) {
        Object.defineProperty(subtle, 'timingSafeEqual', original)
      } else {
        Reflect.deleteProperty(subtle, 'timingSafeEqual')
      }
    }
  })

  test('works on a Web Crypto runtime without a native comparison', async () => {
    const getBuiltin = vi
      .spyOn(process, 'getBuiltinModule')
      .mockImplementation(() => undefined)

    try {
      expect(await tokensMatch('short', 'different')).toBe(false)
      expect(await tokensMatch('same', 'same')).toBe(true)
    } finally {
      getBuiltin.mockRestore()
    }
  })
})
