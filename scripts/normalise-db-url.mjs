// WHAT THIS FILE IS FOR
//   Database passwords often contain symbols like @ or #. Pasted straight into
//   a connection address, those symbols break it: the address reader thinks the
//   password has ended early and treats part of it as the server name.
//   This rewrites the address so any password works.
// WHAT IT NEEDS : a connection address, as the first argument.
// WHAT IT GIVES : the same address with the password safely encoded.

const raw = process.argv[2]
if (!raw) { console.error('No connection address was given.'); process.exit(1) }

const match = raw.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@([^@]+)$/)
if (!match) { process.stdout.write(raw); process.exit(0) }   // nothing to fix

// The password is everything between the FIRST colon after the username and the
// LAST @ sign — so a password containing @ is handled correctly.
const [, scheme, user, password, hostAndRest] = match

// Supabase's DIRECT database address (db.<project>.supabase.co) only answers on
// IPv6, and GitHub's build machines have no IPv6 at all. The failure that
// produces is "Network is unreachable", which blames the network and tells you
// nothing. Say the useful thing instead.
if (/^db\.[a-z0-9]+\.supabase\.co/.test(hostAndRest)) {
  console.error(
    '\nThis is the DIRECT database address, which only works over IPv6.\n' +
    'Build machines cannot reach it, so use the Session pooler address instead.\n\n' +
    'In the Supabase dashboard: Project Settings -> Database -> Connection string\n' +
    '-> choose "Session pooler" -> copy that. It looks like:\n' +
    '  postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n')
  process.exit(1)
}

process.stdout.write(`${scheme}${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostAndRest}`)
