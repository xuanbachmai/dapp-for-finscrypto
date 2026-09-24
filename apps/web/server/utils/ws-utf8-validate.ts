import { isUtf8 } from 'node:buffer'

export default function isValidUtf8(buffer: Uint8Array) {
  return isUtf8(buffer)
}
