import { describe, expect, it } from 'vitest'
import { mask, unmask } from './ws-bufferutil'
import isValidUtf8 from './ws-utf8-validate'

describe('portable WebSocket native fallbacks', () => {
  it('masks and unmasks payloads with the WebSocket XOR algorithm', () => {
    const source = Uint8Array.from([1, 2, 3, 4, 5, 6])
    const maskBytes = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd])
    const output = new Uint8Array(source.length)

    mask(source, maskBytes, output, 0, source.length)
    expect([...output]).toEqual([0xab, 0xb9, 0xcf, 0xd9, 0xaf, 0xbd])

    unmask(output, maskBytes)
    expect([...output]).toEqual([...source])
  })

  it('validates UTF-8 using the Node runtime implementation', () => {
    expect(isValidUtf8(new TextEncoder().encode('FINSCRYPTO'))).toBe(true)
    expect(isValidUtf8(Uint8Array.from([0xc3, 0x28]))).toBe(false)
  })
})
