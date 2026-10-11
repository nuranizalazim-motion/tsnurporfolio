# Nur Aniza Portfolio

Static portfolio for Ts. Nur Aniza Mohd Lazim (HTML, CSS, vanilla JS). No build step.

- `index.html` – the site
- `styles.css`, `main.js` – layout and small interactions
- `hero.js` – cursor-driven gaze animation for the hero
- `assets/hero-sprite-960.jpg`, `assets/hero-sprite-640.jpg` – 48-frame horizontal sprite sheets (desktop / phone)

## Run locally
    python3 -m http.server 8000   # then open http://localhost:8000

## Rebuild the sprite sheet
Frames come from the 10 s classroom clip (24 fps, 240 frames). The sheet uses source
frames 48→25 then 129→152, which form one clean left-to-right head turn.

    ffmpeg -i classroom.mp4 -vsync 0 frames/f%03d.png
    # copy the 48 frames above into sel/s00.png … sel/s47.png in that order, then:
    ffmpeg -start_number 0 -i sel/s%02d.png -vf "scale=960:540:flags=lanczos,tile=48x1" -frames:v 1 -q:v 4 assets/hero-sprite-960.jpg
    ffmpeg -start_number 0 -i sel/s%02d.png -vf "scale=640:360:flags=lanczos,tile=48x1" -frames:v 1 -q:v 4 assets/hero-sprite-640.jpg

## Deploy
Netlify reads `netlify.toml`: publish directory is the repo root, no build command.
