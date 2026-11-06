# Changelog

## [Unreleased]

- Mirror `pi-x-ide`'s statusline text into a Zentui border slot under the publisher key
  `pi-ide-status:ide` by teeing `ctx.ui.setStatus`, stripping SGR, fitting over-limit text and
  dropping consecutive duplicates.
- Warn once per session when `pi-x-ide`'s `status_display` is `widget`, so an empty chip is
  diagnosable.
