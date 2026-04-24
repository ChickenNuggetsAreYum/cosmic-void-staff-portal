export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
