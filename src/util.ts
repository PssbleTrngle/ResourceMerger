import crypto from 'crypto'

export function fileHash(content: Buffer | string, type = 'sha256') {
   return crypto.createHash(type).update(content).digest('hex')
}
