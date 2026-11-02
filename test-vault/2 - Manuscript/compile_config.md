# Manuscript configuration

PyPublisher reads the YAML settings from this fenced block. Add chapter files
or folders to `structure.chapters.contents` before compiling.

```yaml
compile:
  project:
    title: "Untitled"
    subtitle: ""
    author: "Anonymous"
    language: en
    publisher: ""
    rights: ""
    series: ""
    volume: ""
    subject: ""
    description: ""
    contributor: ""
    translator: ""
    isbn: ""

  structure:
    directory: "."
    front_matter: []
    back_matter: []
    chapters:
      numbered_chapters: false
      contents:
	      - files: 
		      - "01_part.md"

  document:
    layout: continuous
    chapter_title_alignment: left
    include_matter: false
    copyright_page: false
    publisher: false
    cover: none
    toc: true
    header_even: none
    header_odd: none

  output:
    directory: "."
    name: ""
    format: pdf
```
