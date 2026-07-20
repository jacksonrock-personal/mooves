'use client'

// Phase 13 surface 2 — author / edit a sponsored move (admin console).

import { useState } from 'react'
import { INTERESTS } from '@/lib/interests'

export interface MoveFormValues {
  title: string
  description: string
  category: string
  brand: string
  areaZip: string
  radiusMiles: string
  linkUrl: string
  imageUrl: string
  timeText: string
}

interface MoveFormProps {
  initial?: Partial<MoveFormValues>
  mode: 'new' | 'edit'
  submitting: boolean
  onSubmit: (values: MoveFormValues, publish: boolean) => void
  onCancel: () => void
  // Single-submit label (edit mode). Lets the sponsor portal reuse this form
  // with "Submit for review" instead of "Save changes".
  submitLabel?: string
  footnote?: string
}

const EMPTY: MoveFormValues = {
  title: '', description: '', category: INTERESTS[0].slug, brand: '',
  areaZip: '', radiusMiles: '25', linkUrl: '', imageUrl: '', timeText: '',
}

export default function MoveForm({ initial, mode, submitting, onSubmit, onCancel, submitLabel, footnote }: MoveFormProps) {
  const [v, setV] = useState<MoveFormValues>({ ...EMPTY, ...initial })
  const set = (k: keyof MoveFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV(prev => ({ ...prev, [k]: e.target.value }))

  const valid = v.title.trim() && v.description.trim() && /^\d{5}$/.test(v.areaZip.trim())

  return (
    <div className="max-w-[620px]">
      <div className="mb-4">
        <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Title</label>
        <input value={v.title} onChange={set('title')} placeholder="e.g. Sunset rooftop set at The Vista"
          className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
      </div>
      <div className="mb-4">
        <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Description</label>
        <textarea value={v.description} onChange={set('description')} rows={3} placeholder="One or two warm sentences. What is it, why leave the house."
          className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500 resize-none leading-relaxed" />
      </div>
      <div className="flex gap-3.5 mb-4">
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Category</label>
          <select value={v.category} onChange={set('category')}
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500 bg-white">
            {INTERESTS.map(i => <option key={i.slug} value={i.slug}>{i.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Brand / venue</label>
          <input value={v.brand} onChange={set('brand')} placeholder="The Vista"
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
        </div>
      </div>
      <div className="flex gap-3.5 mb-4">
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Area ZIP</label>
          <input value={v.areaZip} onChange={e => setV(prev => ({ ...prev, areaZip: e.target.value.replace(/\D/g, '').slice(0, 5) }))} placeholder="60647"
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
        </div>
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Radius (miles)</label>
          <input value={v.radiusMiles} onChange={e => setV(prev => ({ ...prev, radiusMiles: e.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="25"
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
        </div>
      </div>
      <div className="flex gap-3.5 mb-4">
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Time text</label>
          <input value={v.timeText} onChange={set('timeText')} placeholder="Fri 7pm · Mission"
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
          <div className="text-[11.5px] text-grey-300 mt-1.5">Lightweight, no calendar.</div>
        </div>
        <div className="flex-1">
          <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Link URL</label>
          <input value={v.linkUrl} onChange={set('linkUrl')} placeholder="https://…"
            className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-[12px] font-bold text-ink-500 mb-1.5">Image URL (optional)</label>
        <input value={v.imageUrl} onChange={set('imageUrl')} placeholder="https://… (leave blank for none)"
          className="w-full border-[1.5px] border-[#E8E4F5] rounded-[10px] px-3 py-2.5 text-[14px] text-ink-900 outline-none focus:border-purple-500" />
      </div>

      <div className="flex gap-2.5 items-center mt-5">
        {mode === 'new' ? (
          <>
            <button disabled={!valid || submitting} onClick={() => onSubmit(v, true)}
              className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">
              {submitting ? 'Saving…' : 'Publish move'}
            </button>
            <button disabled={!valid || submitting} onClick={() => onSubmit(v, false)}
              className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">
              Save as pending
            </button>
          </>
        ) : (
          <button disabled={!valid || submitting} onClick={() => onSubmit(v, false)}
            className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-40">
            {submitting ? 'Saving…' : (submitLabel ?? 'Save changes')}
          </button>
        )}
        <button onClick={onCancel} className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 ml-auto">
          Cancel
        </button>
      </div>
      {mode === 'new' && (
        <div className="text-[11.5px] text-grey-300 mt-3">
          Mooves-authored moves publish straight to the feed (auto-approved). &ldquo;Save as pending&rdquo; holds it for a second review.
        </div>
      )}
      {footnote && <div className="text-[11.5px] text-grey-300 mt-3 leading-relaxed">{footnote}</div>}
    </div>
  )
}
