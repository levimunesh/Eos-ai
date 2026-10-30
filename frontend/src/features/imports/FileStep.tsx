import { FileSpreadsheet, Lock, UploadCloud, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { InlineError } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useUploadImport } from './api'
import { fileSize } from './format'
import { sortEntities, type EntityType, type ImportRecord } from './types'
import { checkFile } from './wizard-state'

export function FileStep({
  entities,
  doneTypes,
  onUploaded,
}: {
  entities: EntityType[]
  doneTypes: Set<string>
  onUploaded: (rec: ImportRecord) => void
}) {
  const { isOwner } = useOrg()
  const upload = useUploadImport()
  const [type, setType] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const visible = sortEntities(entities).filter((e) => isOwner || !e.owner_only)
  const labels = new Map(entities.map((e) => [e.key, e.label]))

  const pick = (f: File | undefined | null) => {
    if (!f) return
    const err = checkFile(f)
    setFileError(err)
    setFile(err ? null : f)
    upload.reset()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  const submit = () => {
    setAttempted(true)
    if (!type || !file) return
    setProgress(0)
    upload.mutate(
      { entityType: type, file, onProgress: setProgress },
      { onSuccess: (rec) => onUploaded(rec) },
    )
  }

  const pct = Math.round(progress * 100)

  return (
    <div className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{t('imports.file.typeLabel')}</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => {
            const missing = e.depends_on.filter((d) => !doneTypes.has(d))
            const selected = type === e.key
            return (
              <label
                key={e.key}
                className={cn(
                  'relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border p-3.5 transition-colors has-[:focus-visible]:shadow-[0_0_0_3px_var(--ring-halo)]',
                  selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-subtle',
                )}
              >
                <input
                  type="radio"
                  name="entity-type"
                  value={e.key}
                  checked={selected}
                  onChange={() => setType(e.key)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {e.label}
                  {e.owner_only && <Lock aria-label={t('imports.ownerOnly')} className="size-3.5 text-muted" />}
                </span>
                <span className="text-xs text-muted">{e.description}</span>
                {missing.length > 0 && (
                  <span className="text-xs text-warning">
                    {t('imports.needsFirst', { deps: missing.map((d) => labels.get(d) ?? d).join(', ') })}
                  </span>
                )}
              </label>
            )
          })}
        </div>
        {attempted && !type && <p role="alert" className="text-xs font-medium text-danger-text">{t('imports.file.pickType')}</p>}
      </fieldset>

      <div className="flex flex-col gap-2">
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
              <FileSpreadsheet aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted tabular-nums">{fileSize(file.size)}</p>
            </div>
            {!upload.isPending && (
              <Button variant="ghost" size="icon-sm" aria-label={t('imports.file.change')} onClick={() => setFile(null)}>
                <X />
              </Button>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-subtle/50',
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-xs">
              <UploadCloud aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t('imports.file.dropTitle')}</p>
              <p className="text-xs text-muted">{t('imports.file.limits')}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
              {t('imports.file.browse')}
            </Button>
            <input
              ref={input}
              id={inputId}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label={t('imports.file.browse')}
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        )}
        {fileError && <p role="alert" className="text-xs font-medium text-danger-text">{fileError}</p>}
        {attempted && !file && !fileError && <p role="alert" className="text-xs font-medium text-danger-text">{t('imports.file.pickFile')}</p>}
      </div>

      {upload.isPending && (
        <div className="flex flex-col gap-2" role="status">
          <div className="flex items-center justify-between text-xs text-muted tabular-nums">
            <span>{pct < 100 ? t('imports.file.uploading', { pct }) : t('imports.file.reading')}</span>
          </div>
          <div
            role="progressbar"
            aria-label={t('imports.file.upload')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 overflow-hidden rounded-full bg-subtle"
          >
            <div className="h-full rounded-full bg-[image:var(--dawn)] transition-[width] duration-200" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>
      )}

      <InlineError error={upload.error} />

      <div className="flex justify-end border-t border-line pt-5">
        <Button onClick={submit} disabled={upload.isPending} className="w-full sm:w-auto sm:min-w-44">
          {t('imports.file.upload')}
        </Button>
      </div>
    </div>
  )
}
