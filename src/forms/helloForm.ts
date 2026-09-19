// WHAT THIS FILE IS FOR
//   The single form this first version uses to prove the whole path works.
//   In the next phase it is replaced by forms an administrator builds on
//   screen — which is exactly why its shape is already ordinary information
//   rather than code. Nothing about this file is special; it is just data.
export type Question = {
  readonly id: string
  readonly type: 'text'
  readonly label: { readonly bn: string; readonly en: string }
  readonly required: boolean
}

export type Form = {
  readonly id: string
  readonly version: number
  readonly title: { readonly bn: string; readonly en: string }
  readonly questions: readonly Question[]
}

export const helloForm: Form = {
  id: 'hello',
  version: 1,
  title: { bn: 'পরিচিতি', en: 'Introduction' },
  questions: [
    { id: 'name',    type: 'text', label: { bn: 'নাম',  en: 'Name' },    required: true },
    { id: 'village', type: 'text', label: { bn: 'গ্রাম', en: 'Village' }, required: true },
  ],
}
