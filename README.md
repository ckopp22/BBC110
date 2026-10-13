# BBC110

Design a screen, hit **Publish**, and show it on any TV or projector. Plain HTML/CSS/JS, installable PWA, no accounts, no server.

Live: https://ckopp22.github.io/BBC110/

## Status
- Phases 1 to 7 complete (foundation, core engine, editor basics, style system, smart elements, animation, templates). See `BBC110_MDD.md` §14 for the roadmap.

## Run locally
Serve the folder with any static server (service workers need http://localhost or https):

    python3 -m http.server 8000

then open http://localhost:8000/.

## Releasing
Bump `CACHE_VERSION` in `sw.js` on every release so installed PWAs pick up the update. All paths are relative so the app works on a GitHub Pages subpath.

## Layout
`renderer.js` is shared by the editor and Show mode (`show.html`), so what you see is what gets published.

## Fonts
Bundled fonts in `assets/fonts` are licensed under the SIL Open Font License (latin subset, from Fontsource).
