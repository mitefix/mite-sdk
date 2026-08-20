<h1 align="center">Mite SDK</h1>

<p align="center">
  Bug reporting, release management, and feature requests for React Native apps.
</p>

<p align="center">
  <a href="https://usemite.com"><strong>usemite.com</strong></a> ·
  <a href="https://docs.usemite.com"><strong>docs.usemite.com</strong></a> ·
  <a href="https://www.npmjs.com/package/@usemite/sdk"><strong>npm</strong></a>
</p>

---

Mite gives your users a way to report bugs from inside your app — a shake
gesture, an annotated screenshot, and the device context you need to fix the
problem. It also shows release notes after an update, collects feature
requests, and asks happy users for a store review.

```bash
npm install @usemite/sdk
```

**New here?** Start at [usemite.com](https://usemite.com) to create a project
and get an API key, then follow the
[Getting Started guide](https://docs.usemite.com/).

**Already installed?** The full SDK reference is in
[docs.usemite.com](https://docs.usemite.com), and the package README is in
[`package/`](package/README.md).

## Repository

This is a Bun workspace monorepo:

| Directory | Contents |
| --- | --- |
| [`package/`](package) | The `@usemite/sdk` package |
| [`example/`](example) | Expo demo app |

```bash
bun install
bun typescript          # typecheck every workspace
cd package && bun test  # run SDK tests
cd example && bun start # run the demo app
```

The documentation site lives in its own repo:
[usemite/docs](https://github.com/usemite/docs).

## License

MIT
