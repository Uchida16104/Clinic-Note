export function basicAuth(req, res, next) {
  const h = req.headers.authorization
  if (!h) return res.sendStatus(401)
  const [u, p] = Buffer.from(h.split(' ')[1], 'base64').toString().split(':')
  if (u === process.env.BASIC_USER && p === process.env.BASIC_PASSWORD) {
    req.user = u
    next()
  } else res.sendStatus(403)
}
