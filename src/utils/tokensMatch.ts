export const tokensMatch = async (provided: string, expected: string) => {
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?(a: ArrayBuffer, b: ArrayBuffer): boolean
  }
  if (subtle.timingSafeEqual) {
    return subtle.timingSafeEqual(providedHash, expectedHash)
  }

  const nodeProcess = (
    globalThis as typeof globalThis & {
      process?: {
        getBuiltinModule?: (id: string) =>
          | {
              timingSafeEqual?: (a: Uint8Array, b: Uint8Array) => boolean
            }
          | undefined
      }
    }
  ).process
  const nodeCompare =
    nodeProcess?.getBuiltinModule?.('node:crypto')?.timingSafeEqual
  const providedBytes = new Uint8Array(providedHash)
  const expectedBytes = new Uint8Array(expectedHash)
  if (nodeCompare) {
    return nodeCompare(providedBytes, expectedBytes)
  }

  // SHA-256 gives equal-length inputs; visit every byte if no native compare exists.
  let difference = 0
  for (let i = 0; i < providedBytes.length; i++) {
    difference |= providedBytes[i]! ^ expectedBytes[i]!
  }
  return difference === 0
}
