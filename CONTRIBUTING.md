# Contributing

Issues and pull requests are welcome.
Keep the app free to use, accessible, private, and usable without a build step.
Avoid adding runtime dependencies for functionality that browser APIs can provide.

## Verify Changes

Run `node --check app.js` and `node --test tests/*.test.mjs`.
Test the affected behavior in a real browser and include the results in your pull request.

For changes to playback or controls, check:

1. An empty or whitespace-only script cannot enter the reading view.
2. A multiline script survives a reload along with its settings.
3. Play, pause, restart, end-of-script, and return-to-editor work.
4. Keyboard shortcuts work, and focused inputs retain normal keyboard behavior.
5. Mirror and flip transform the text while controls remain readable.
6. Controls remain available while paused and while focused with the keyboard.
7. Mouse wheel and touch scrolling work without accidental playback toggles after dragging.
8. Desktop and narrow mobile layouts have no horizontal overflow or inaccessible controls.
9. Import and download preserve plain-text content; script text is never treated as HTML.
10. Denied fullscreen, unavailable wake lock, and unavailable storage do not break prompting.

Do not commit scripts containing personal information, credentials, local test output, or server keys.
