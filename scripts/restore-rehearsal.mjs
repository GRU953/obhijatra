// WHAT THIS FILE IS FOR
//   An untested backup is not a backup. This reads a backup file and reports
//   what is actually inside it, so a rehearsal can prove it would restore.
// WHAT IT NEEDS : the path to a database backup file.
// WHAT IT GIVES : how many tables and rows it holds. Throws if it was cut short.
import { readFileSync } from 'node:fs'

export async function verifyRestore(dumpPath) {
  const sql = readFileSync(dumpPath, 'utf8')   // throws if the file is missing
  if (!/-- PostgreSQL database dump complete/.test(sql)) {
    throw new Error(
      `This backup is incomplete: ${dumpPath} has no end marker, so it was cut short. Do not rely on it.`,
    )
  }
  const tables = (sql.match(/^CREATE TABLE /gm) || []).length
  const rows = (sql.match(/^INSERT INTO |^COPY /gm) || []).length
  return { tables, rows }
}
