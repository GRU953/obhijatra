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
process.stdout.write(`${scheme}${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostAndRest}`)
