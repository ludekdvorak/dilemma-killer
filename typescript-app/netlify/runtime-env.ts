// Netlify's deployed function must never fall back to development credentials.
// Netlify Dev sets NETLIFY_LOCAL, so local function testing can still use .env defaults.
if (!process.env.NETLIFY_LOCAL) {
  process.env.NODE_ENV ??= 'production';
}
