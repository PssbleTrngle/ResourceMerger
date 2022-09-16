import crypto from 'crypto'
import tmp from 'tmp'

export function fileHash(content: Buffer | string, type = 'sha256') {
   return crypto.createHash(type).update(content).digest('hex')
}

export function createTempDir() {
   return tmp.dirSync({ unsafeCleanup: true })
}
