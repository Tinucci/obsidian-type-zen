# TypeZen Plugin for Obsidian

The true typewriting experience for Obsidian.

## Description

TypeZen is an Obsidian Plugin to enhance the typewriting experience.

## Compile with PyPublisher

The PyPublisher project path defaults to `/Users/atinucci/Desktop/AI_Projects/PyPublisher`.
Change it in TypeZen settings if the project is elsewhere. PyPublisher and its
dependencies must already be installed; TypeZen runs `uv` with `--no-sync`.
It adds common Homebrew and TeX paths to the subprocess PATH and passes the
discovered Pandoc executable to PyPublisher.

Zen mode hides the Obsidian tab header and shows only the active note's vault
path. Content centering is always enabled, and graph controls remain hidden.

Open a note in a folder containing `compile_config.yaml` or `compile_config.md`
and run **TypeZen:
Compile active note's folder with PyPublisher** from the command palette, or
right-click that folder and select **Compile with PyPublisher**. PyPublisher
writes its PDF and EPUB beside the configuration file. Compilation status is
shown in Obsidian; failure details are available in the developer console.

To create a starter `compile_config.md`, run **TypeZen: Create PyPublisher
template for active note's folder** from the command palette or right-click a
folder and select **Create PyPublisher template**. The initializer runs from the
configured PyPublisher project directory and reports errors in the developer
console.

Run `npm test` to type-check and compile the plugin bundle.

## Development

Install the locked dependencies, then build and copy the plugin to the local test vault:

```sh
npm ci
npm run dev
```

Open the local `test-vault` folder as a vault in Obsidian to try the plugin.

Create a production plugin package with:

```sh
npm run build
```

The installable files are written to `out/`.

## Known Issues
- [ ] When the cursor is in the note title, typewriter scrolling does not follow it.
