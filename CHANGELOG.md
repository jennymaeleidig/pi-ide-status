# Changelog

## [Unreleased]

- Mirror `pi-x-ide`'s statusline text into a Zentui border slot under the publisher key
  `pi-ide-status:ide` by teeing `ctx.ui.setStatus`, stripping SGR, control characters and lone
  surrogates, fitting over-limit text at a grapheme boundary, and dropping consecutive
  duplicates.
- Warn once per session when `pi-x-ide`'s `status_display` is `widget`, so an empty chip is
  diagnosable.
- Contain a throwing predecessor under `pi-x-ide`: no throw escapes and nothing is mirrored, while
  any other key's failure is forwarded unchanged.
