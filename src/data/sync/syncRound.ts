// WHAT THIS FILE IS FOR
//   One round of syncing: send the worker's work up, then bring new forms down.
//
// THE ORDER IS THE POINT
//   Getting a worker's day OFF the phone is the higher duty, so it goes first.
//   An earlier design brought forms down first. The failure that actually
//   happens in a village is not a connection that refuses -- it is one that is
//   accepted and then goes nowhere: a handover between cells, a captive portal,
//   a saturated tower. Such a request never rejects and never resolves. The
//   forms download would hang for ever, the upload would never be reached, and
//   six weeks of collected work would sit on the phone while the worker watched
//   a disabled button and believed the app was broken.
//
// EVERY REQUEST HAS A DEADLINE
//   For the same reason. Thirty seconds is generous even on 2G, and a request
//   that has not answered by then is not going to.
//
// NOTHING HERE EVER THROWS
//   A worker must always be told something. Silence is the failure this project
//   has already shipped once.

export type UploadOutcome = { sent: number; failed: number; stillWaiting: number }
export type DownloadOutcome = { received: number; refused: string[]; alreadyHeld: number }

export type SyncRound = {
  upload: UploadOutcome & { timedOut: boolean; problem?: string }
  download: DownloadOutcome & { timedOut: boolean; problem?: string }
  ok: boolean
  message: string
}

/** Thirty seconds is generous on 2G. Longer than this is a hang, not slowness. */
export const DEFAULT_DEADLINE_MS = 30_000

const TIMED_OUT = Symbol('timed-out')

/** Waits for a job, but never longer than the deadline. */
async function withDeadline<T>(job: () => Promise<T>, deadlineMs: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      job(),
      new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), deadlineMs) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Whether a failure was the server saying no, or the connection going away.
 *
 * This distinction matters more than it looks. The installed client returns a
 * network failure as an ordinary error object rather than throwing, so the two
 * arrive looking identical. Counting a dropped connection as a rejection would
 * let a week of bad signal permanently block work that is perfectly good.
 *
 * Anything unrecognised is treated as a lost connection, because that is the
 * safe guess: it means "try again later" rather than "give up on this row".
 */
export function classifyFailure(error: { message?: string } | null | undefined): 'refused-by-server' | 'connection-lost' {
  const message = (error?.message ?? '').toLowerCase()

  // Only a RECOGNISED server refusal counts as a refusal. Everything else --
  // including anything nobody has seen before -- is treated as a lost
  // connection, which means "try again later" rather than "give up on this
  // row". Guessing the other way round would count a strike against work that
  // is perfectly good, and a week of bad signal would permanently kill a
  // worker's records. The safe guess is the one that loses nothing.
  const KNOWN_SERVER_REFUSALS = [
    'row-level security', 'violates', 'permission denied', 'duplicate key',
    'not-null constraint', 'check constraint', 'foreign key',
    'invalid input', 'jwt', 'unauthorized', 'forbidden',
  ]
  return KNOWN_SERVER_REFUSALS.some((sign) => message.includes(sign))
    ? 'refused-by-server'
    : 'connection-lost'
}

export async function runSyncRound(options: {
  upload: () => Promise<UploadOutcome>
  download: () => Promise<DownloadOutcome>
  deadlineMs?: number
}): Promise<SyncRound> {
  const deadline = options.deadlineMs ?? DEFAULT_DEADLINE_MS

  // 1. The worker's work goes up FIRST. Always.
  let upload: SyncRound['upload'] = { sent: 0, failed: 0, stillWaiting: 0, timedOut: false }
  try {
    const outcome = await withDeadline(options.upload, deadline)
    upload = outcome === TIMED_OUT
      ? { sent: 0, failed: 0, stillWaiting: 0, timedOut: true }
      : { ...outcome, timedOut: false }
  } catch (error) {
    upload = { sent: 0, failed: 0, stillWaiting: 0, timedOut: false,
               problem: error instanceof Error ? error.message : String(error) }
  }

  // 2. New forms come down second, and are a separate duty. The upload timing
  //    out does not mean the download will, and vice versa.
  let download: SyncRound['download'] = { received: 0, refused: [], alreadyHeld: 0, timedOut: false }
  try {
    const outcome = await withDeadline(options.download, deadline)
    download = outcome === TIMED_OUT
      ? { received: 0, refused: [], alreadyHeld: 0, timedOut: true }
      : { ...outcome, timedOut: false }
  } catch (error) {
    download = { received: 0, refused: [], alreadyHeld: 0, timedOut: false,
                 problem: error instanceof Error ? error.message : String(error) }
  }

  const uploadFailed = upload.timedOut || upload.problem !== undefined
  const downloadFailed = download.timedOut || download.problem !== undefined
  const ok = !uploadFailed && !downloadFailed

  let message: string
  if (ok && upload.stillWaiting === 0) {
    message = 'সব পাঠানো হয়েছে · Everything sent'
  } else if (uploadFailed) {
    message = 'সংযোগ নেই — আপনার কাজ এই ফোনে নিরাপদ · No connection — your work is safe on this phone'
  } else if (upload.stillWaiting > 0) {
    message = `${upload.stillWaiting} টি ফর্ম পাঠানোর অপেক্ষায় · ${upload.stillWaiting} form(s) still waiting`
  } else {
    message = 'কাজ পাঠানো হয়েছে; নতুন ফর্ম পরে আসবে · Your work was sent; new forms will arrive later'
  }

  return { upload, download, ok, message }
}
