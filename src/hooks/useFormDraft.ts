'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { FormInstance } from 'antd'

import { clearDraft, readDraft, saveDraft } from '@/lib/forms/draft-storage'
import { SESSION_EXPIRED_EVENT } from '@/lib/http/events'

type RestoredFormValues<TValues> = Parameters<FormInstance<TValues>['setFieldsValue']>[0]

interface FormDraftOptions<TValues, TDraft> {
  key: string
  enabled: boolean
  form: FormInstance<TValues>
  serialize: (values: TValues) => TDraft
  deserialize: (draft: TDraft) => RestoredFormValues<TValues>
  validate: (value: unknown) => value is TDraft
}

interface FormDraftControls {
  save: () => void
  restore: () => boolean
  clear: () => void
}

export function useFormDraft<TValues, TDraft>({
  key,
  enabled,
  form,
  serialize,
  deserialize,
  validate,
}: FormDraftOptions<TValues, TDraft>): FormDraftControls {
  const serializeRef = useRef(serialize)
  const deserializeRef = useRef(deserialize)
  const validateRef = useRef(validate)

  useEffect(() => {
    serializeRef.current = serialize
    deserializeRef.current = deserialize
    validateRef.current = validate
  }, [deserialize, serialize, validate])

  const save = useCallback(() => {
    if (!enabled) return
    saveDraft(key, serializeRef.current(form.getFieldsValue(true)))
  }, [enabled, form, key])

  const restore = useCallback(() => {
    if (!enabled) return false
    const draft = readDraft(key, validateRef.current)
    if (!draft) return false
    form.setFieldsValue(deserializeRef.current(draft))
    return true
  }, [enabled, form, key])

  const clear = useCallback(() => clearDraft(key), [key])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener(SESSION_EXPIRED_EVENT, save)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, save)
  }, [enabled, save])

  return { save, restore, clear }
}
