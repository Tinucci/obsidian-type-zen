# TypeZen Plugin for Obsidian

The true typewriting experience for Obsidian.

## Description

TypeZen is an Obsidian Plugin to enhance the typewriting experience.

## Development

Install the locked dependencies, then build and copy the plugin to the local test vault:

```sh
npm ci
npm run dev
```

Open the local `test-vault` folder as a vault in Obsidian to try the plugin.

Create a production bundle with:

```sh
npm run build
```

## Known Issues
- [ ] When the cursor is in the note title, typewriter scrolling does not follow it.
