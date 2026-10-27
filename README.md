# TypeZen Plugin for Obsidian

The true typewriting experience for Obsidian.

## Description

TypeZen is an Obsidian Plugin to enhance the typewriting experience.

## Compile with PyPublisher

The PyPublisher project path defaults to `/Users/atinucci/Desktop/AI_Projects/PyPublisher`.
Change it in TypeZen settings if the project is elsewhere. TypeZen searches
common install locations for `uv` when Obsidian's app `PATH` cannot find it;
you can set its absolute path in settings if it is installed elsewhere.
PyPublisher and its dependencies must already be installed; TypeZen runs `uv`
with `--no-sync`. It adds common Homebrew and TeX paths to the subprocess PATH
so tools such as Pandoc and XeLaTeX remain available when Obsidian was opened
from the desktop.

Open a note in a folder containing `compile_config.yaml` and run **TypeZen:
Compile active note's folder with PyPublisher** from the command palette, or
right-click that folder and select **Compile with PyPublisher**. PyPublisher
writes its PDF and EPUB beside the configuration file. Compilation status is
shown in Obsidian; failure details are available in the developer console.

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
