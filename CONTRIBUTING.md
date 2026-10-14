# Contributing

Thanks for your interest in @warpfi/js.

## Development

1. Fork the repository and create a branch from `main`.
2. Follow the setup in the [README](./README.md#development).
3. Before opening a pull request, make sure these pass:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. Open a pull request describing what changed and why. Link any related issue.

Use testnet sessions (created with an `sk_test_` key) when testing the embed against a real checkout. Testnet sessions also allow `http://localhost` and `http://127.0.0.1` as parent origins.

## Guidelines

- Keep pull requests focused on a single change.
- Never commit secrets or `.env` files.
- Keep the package free of runtime dependencies and safe to import during server-side rendering.
- Changes to the message protocol must stay compatible with the hosted checkout. Open an issue first.
- For larger changes, open an issue first so we can agree on the approach.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).
