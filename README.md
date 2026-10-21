# TypeZen Plugin for Obsidian

The true typewriting experience for Obsidian.

## Description

TypeZen is an Obsidian Plugin to enhance the typewriting experience.

## Development

Install the locked dependencies, then start the development watcher:

```sh
npm ci
npm run dev
```

The watcher rebuilds `main.js` and copies the plugin files into the local `test-vault` whenever a source file changes. Open that folder as a vault in Obsidian to try the plugin.

Create a production bundle with:

```sh
npm run build
```

## Known Issues
- [ ] When the cursor is in the note title, typewriter scrolling does not follow it.
