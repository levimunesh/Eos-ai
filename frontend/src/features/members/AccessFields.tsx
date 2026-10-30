import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { t } from '@/lib/strings'
import { ROLES, type Branch } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { AccessValues } from './schemas'

interface Props {
  control: Control<AccessValues>
  errors: FieldErrors<AccessValues>
  branches: Branch[]
  idPrefix: string
  allBranches: boolean
}

/** Role radio cards plus branch scope. Shared by the invite and edit-access dialogs. */
export function AccessFields({ control, errors, branches, idPrefix, allBranches }: Props) {
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t('members.role')}</legend>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <div role="radiogroup" className="flex flex-col gap-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:shadow-[0_0_0_3px_var(--ring-halo)]',
                    field.value === r ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-role`}
                    value={r}
                    checked={field.value === r}
                    onChange={() => field.onChange(r)}
                    className="mt-1 accent-[var(--accent)] focus-visible:outline-none"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{t(`roles.${r}`)}</span>
                    <span className="text-xs text-muted">{t(`members.roleHelp.${r}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t('members.branchAccess')}</legend>
        <Controller
          control={control}
          name="allBranches"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Checkbox
                id={`${idPrefix}-all`}
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                disabled={branches.length === 0 && field.value}
              />
              <Label htmlFor={`${idPrefix}-all`} className="font-normal">
                {t('members.allBranchesOption')}
              </Label>
            </div>
          )}
        />
        {branches.length === 0 ? (
          <p className="text-xs text-muted">{t('members.noBranchesYet')}</p>
        ) : (
          !allBranches && (
            <Controller
              control={control}
              name="branchIds"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">{t('members.chooseBranches')}</p>
                  <ul
                    aria-describedby={errors.branchIds ? `${idPrefix}-branches-error` : undefined}
                    className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line"
                  >
                    {branches.map((b) => {
                      const id = `${idPrefix}-b-${b.id}`
                      const checked = field.value.includes(b.id)
                      return (
                        <li key={b.id} className="flex min-h-11 items-center gap-3 px-3 py-2">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(v === true ? [...field.value, b.id] : field.value.filter((x) => x !== b.id))
                            }
                          />
                          <Label htmlFor={id} className="flex min-w-0 flex-1 gap-2 font-normal">
                            <span className="font-medium">{b.code}</span>
                            <span className="truncate text-fg-2">{b.name}</span>
                            {!b.is_active && <span className="text-xs text-muted">({t('branches.inactive')})</span>}
                          </Label>
                        </li>
                      )
                    })}
                  </ul>
                  {errors.branchIds && (
                    <p id={`${idPrefix}-branches-error`} role="alert" className="text-xs text-danger-text">
                      {errors.branchIds.message}
                    </p>
                  )}
                </div>
              )}
            />
          )
        )}
      </fieldset>
    </>
  )
}
