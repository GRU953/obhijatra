// WHAT THIS FILE IS FOR
//   The one form the app ships with while there is no builder yet. It is
//   ORDINARY INFORMATION, not code -- exactly the shape a supervisor's published
//   edition will have -- so the screen that draws it needs no change when real
//   forms start arriving from the server.
//
//   It also exercises a hidden question, so the privacy promise (an answer the
//   worker hides is deleted) is visible in the app and not only in the tests.
import type { FormDefinition } from './definition'

export const helloForm: FormDefinition = {
  formId: 'hello',
  edition: 1,
  title: { bn: 'পরিচিতি', en: 'Introduction' },
  questions: [
    { id: 'name',    type: 'short-text', required: true,
      label: { bn: 'নাম', en: 'Name' } },
    { id: 'village', type: 'short-text', required: true,
      label: { bn: 'গ্রাম', en: 'Village' } },
    { id: 'hasChildren', type: 'yes-no', required: false,
      label: { bn: 'পরিবারে শিশু আছে?', en: 'Any children in the household?' } },
    { id: 'childCount', type: 'whole-number', required: false,
      label: { bn: 'কতজন শিশু?', en: 'How many children?' },
      showIf: { question: 'hasChildren', operator: 'is', value: true },
      checks: [{ type: 'largest', value: 30,
                 message: { bn: 'সংখ্যাটি অনেক বেশি মনে হচ্ছে', en: 'That seems too many' } }] },
  ],
}
