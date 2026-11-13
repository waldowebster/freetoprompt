# Free to Prompt

A free, open source teleprompter that runs in your browser.

**[Use Free to Prompt](https://freetoprompt.com)**

No signup, subscription, runtime dependencies, or build step.
Your script and settings stay in your browser's local storage.

## Features

- Smooth scrolling with adjustable speed, text size, brightness, and width.
- Live text size and brightness preview in the script editor.
- Horizontal mirroring and vertical flipping for teleprompter hardware.
- Keyboard controls, mouse wheel scrolling, and touch scrolling.
- Fullscreen and screen wake lock where supported by the browser.
- Automatic local saving, plain-text import, and script download.
- Responsive controls and a distraction-free reading view.

## Run Locally

Download the repository and open `index.html` in a browser, or serve it locally:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>.
Fullscreen, wake lock, and local storage behavior vary by browser, particularly when opening files directly.
Use localhost or HTTPS for the most consistent experience.

## Controls

| Action | Keyboard |
| --- | --- |
| Play | Ctrl/Cmd + Enter |
| Play or pause | Space |
| Scroll backward / forward | Up / Down |
| Decrease / increase speed | Left / Right |
| Decrease / increase text size | - / + |
| Restart | R or Home |
| Mirror | M |
| Fullscreen | F |
| Return to editor | Escape |

Shortcuts apply in the reading view; focused form controls retain their normal keyboard behavior.
Click or tap the reading area to play or pause.
Playback pauses when the tab becomes hidden.

## Privacy

Scripts are processed locally and are never sent to the server by this app.
There are no analytics, advertising scripts, accounts, third-party fonts, or external runtime dependencies.
The hosting provider still handles normal web requests, including IP addresses.
Browser storage can be cleared by the browser, private browsing, or the user.
Download a copy of any script you want to keep.

## Development

The app consists of `index.html`, `styles.css`, and `app.js`.
The original single-file script is preserved in the first Git commit.

Run the source checks with Node.js 22 or later:

```sh
node --check app.js
node --test tests/*.test.mjs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for browser verification and contribution guidelines.
See [deploy/README.md](deploy/README.md) to self-host with Caddy and automatic HTTPS.

## License

[MIT](LICENSE), copyright Waldo Webster.
