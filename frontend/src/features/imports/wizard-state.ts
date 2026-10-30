import { t } from '@/lib/strings'
import { fileSize } from './format'
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, type ImportRecord } from './types'

/** Client-side checks before upload; the server repeats them. */
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return t('imports.file.badType')
  if (file.size === 0) return t('imports.file.empty')
  if (file.size > MAX_FILE_BYTES) return t('imports.file.tooBig', { size: fileSize(file.size) })
  return null
}

export type WizardView = 'file' | 'map' | 'checking' | 'review' | 'importing' | 'done' | 'failed'

/** Which wizard screen an import's status lands on (also used to resume from ?id=). */
export function viewFor(rec: ImportRecord | undefined, editing: boolean): WizardView {
  if (!rec) return 'file'
  switch (rec.status) {
    case 'uploaded':
    case 'mapped':
      return 'map'
    case 'validating':
      return 'checking'
    case 'validated':
      return editing ? 'map' : 'review'
    case 'importing':
      return 'importing'
    case 'done':
      return 'done'
    case 'failed':
      return editing ? 'map' : 'failed'
  }
}
