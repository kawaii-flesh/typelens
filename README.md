# Typelens
Fork of the project [TypeLens](https://github.com/kisstkondoros/typelens.git)

A VSCode plugin which adds reference counter code lenses to **typescript, javascript, scss and less** files.

## It looks like this:

![Example code with references code lens](https://raw.githubusercontent.com/kawaii-flesh/typelens/master/screenshot.png)

## Configuration properties

- typelens.exclude
  - Array of patterns (in glob format) to exclude
- typelens.blackboxTitle
  - Localization for the case where the only usages are from blackboxed sources
- typelens.blackbox
  - Array of glob patterns for blackboxed resources
- typelens.excludeself
  - A flag which indicates whether the initiating reference should be excluded
- typelens.decorateunused
  - A flag which indicates whether the initiating reference should be decorated if it is unsed
- typelens.skiplanguages
  - Languages where the references should not be shown
- typelens.singular
  - Localization for the singular case
- typelens.plural
  - Localization for the plural case
- typelens.noreferences
  - Localization for the case when there are no references found
- typelens.unusedcolor
  - Color for unused references
