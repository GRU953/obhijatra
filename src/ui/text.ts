// WHAT THIS FILE IS FOR
//   Every word the app says, in both languages, in one place. Nothing anywhere
//   else in the app contains text a person reads — so translating the whole app
//   means editing this one file, and nothing can be accidentally left in English.
export const text = {
  appName:        { bn: 'অভিযাত্রা',                  en: 'Obhijatra' },
  unlocking:      { bn: 'খোলা হচ্ছে…',                 en: 'Opening…' },
  touchSensor:    { bn: 'আঙুলের ছাপ দিন',              en: 'Touch the fingerprint sensor' },
  usePin:         { bn: 'পিন দিয়ে খুলুন',              en: 'Use a PIN instead' },
  enterPin:       { bn: 'আপনার পিন লিখুন',             en: 'Enter your PIN' },
  createPin:      { bn: 'একটি নতুন পিন তৈরি করুন',      en: 'Create a PIN' },
  pinTooShort:    { bn: 'পিন কমপক্ষে ৬ সংখ্যার হতে হবে', en: 'A PIN must be at least 6 digits' },
  pinWrong:       { bn: 'পিন মেলেনি',                  en: 'That PIN is not right' },
  attemptsLeft:   { bn: 'বার চেষ্টা বাকি',              en: 'attempts left' },
  unlock:         { bn: 'খুলুন',                       en: 'Unlock' },
  save:           { bn: 'সংরক্ষণ করুন',                 en: 'Save' },
  saved:          { bn: 'সংরক্ষণ হয়েছে',                en: 'Saved on this phone' },
  required:       { bn: 'এটি পূরণ করতে হবে',            en: 'This must be filled in' },
  sendNow:        { bn: 'এখনই পাঠান',                   en: 'Send now' },
  sending:        { bn: 'পাঠানো হচ্ছে…',                en: 'Sending…' },
  allSent:        { bn: 'সব পাঠানো হয়েছে',              en: 'Everything sent' },
  waitingToSend:  { bn: 'টি ফর্ম পাঠানোর অপেক্ষায়',      en: 'form(s) waiting to send' },
  noConnection:   { bn: 'সংযোগ নেই — আপনার কাজ এই ফোনে নিরাপদ', en: 'No connection — your work is safe on this phone' },
  newForm:        { bn: 'নতুন ফর্ম',                    en: 'New form' },
  viewSent:       { bn: 'পাঠানো তথ্য দেখুন',             en: 'See what was sent' },
  back:           { bn: 'ফিরে যান',                     en: 'Back' },
  nothingYet:     { bn: 'এখনও কিছু নেই',                 en: 'Nothing here yet' },
} as const

export type Language = 'bn' | 'en'

/** Both languages together, the way the app shows them everywhere. */
export function both(key: keyof typeof text): string {
  return `${text[key].bn} · ${text[key].en}`
}
