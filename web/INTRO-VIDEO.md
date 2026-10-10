# Inquire intro screen: background video guide

Researched 3 Oct 2026. Tool names, versions and prices come from third-party roundups published Sep 2026 and change often; none of these tools were run for this write-up. Check each tool's own pricing page before paying.

## What the AI video tool should (and should not) do

The intro has four layers. Only the first needs a video generator.

| Layer | Made by | Why |
| --- | --- | --- |
| Moving storm clouds + neurons that subtly fire | **AI video** (looping, 8–10 s, no logo, no text) | This is the part that is hard to do by hand |
| Logo fading in slowly | **App code** (`web/src/intro.js`, CSS) | AI video warps logos and text from frame to frame; a live PNG stays exact |
| Username / password form appearing | **App code** | Real inputs, not pixels |
| Neuron sparks (fallback) | **App code** (canvas) | Plays automatically until a video file exists |

The app already plays the whole sequence today with the still image and canvas sparks. A video replaces only the background.

## Start frame

`web/intro-video/clean-plate-for-video.png` is your second image with the logo painted out (1672 × 941). Use this, not the original: if the logo is in the start frame the generator will bend and melt it. Some tools want 1920 × 1080; upscale or let the tool crop. The faint darker patch in the centre is where the logo was; the live logo covers it in the app.

## Which tool

All of these accept a still image and can animate it. What matters here is **first-frame/last-frame control**: if you give the same image as both the first and the last frame, the model is pushed to return to where it started, which gives a loop.

1. **Google Veo 3.1 (in Flow)**: documented loop method (same image as first and last frame, ~8 s clip). Cinematic, good at atmosphere. API price quoted at roughly $0.05–$0.40 per second depending on tier. **Try this first.**
2. **Kling 3.0 / 3.0 Turbo**: start and end frames supported, roughly $0.11–$0.14 per second quoted. Cheap enough to try many takes.
3. **Luma Ray 3.x (Dream Machine)**: strong on mood and atmospheric shots, keyframes, and (as of a 2024 review) a loop checkbox. Quoted at about double the cost per finished clip of Veo/Kling.
4. **Runway Gen-4.5**: best camera and motion control, credit-based. Pick it if the others drift or move the camera.
5. **Seedance 2.x**: image-to-video with first/last frame, long clips. Newer; worth a test.

**Local/open models (Wan, LTX)**: not practical on a Mac. One test on an M1 Max with 64 GB took 82 minutes for a 2-second Wan 2.2 clip and produced almost no motion. Skip unless you have an NVIDIA GPU.

Expect several tries per keeper. Budget roughly 20 generations before judging a tool, as the pricing roundups suggest.

## Prompt (paste, then adjust)

Veo / Kling / Luma, with the clean plate as **both** first and last frame:

> Seamless loop. A vast dark storm-cloud sea at night under a deep navy sky. The clouds drift very slowly to the right. Tiny pale-blue neurons and thin electric filaments inside the clouds softly pulse and fire in turn, one cluster at a time, then fade. Fixed camera, no camera movement, no zoom. Constant lighting and exposure. No new objects, no text, no logo, no people. Cinematic, calm, subtle motion.

Negative prompt if the tool has one: `logo, text, letters, camera shake, zoom, fast motion, lightning flash, cut, fade to black, people`.

Tips:
- Ask for **slow** motion and **subtle** firing. Fast motion makes loops pop and distracts from the form.
- If the clouds boil or the colour shifts, add "constant lighting and exposure throughout".
- If the camera wanders, say "locked-off static camera".
- Keep the centre dark and calm: the logo and form sit there.

## Make it loop cleanly

Even with matching first/last frames there is usually a small pop. `web/intro-video/make-loop.sh` fixes that by cross-fading the end of the clip into its start (it needs `ffmpeg`, which you can install with `brew install ffmpeg`):

```bash
bash web/intro-video/make-loop.sh generated.mp4 loop.mp4 1.5     # 1.5 s cross-fade; output is 1.5 s shorter
```

Then encode for the app (silent, 1080p, small):

```bash
ffmpeg -i loop.mp4 -an -vf scale=1920:-2 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart app/intro/inq-intro.mp4
ffmpeg -i loop.mp4 -an -vf scale=1920:-2 -c:v libvpx-vp9 -crf 34 -b:v 0 app/intro/inq-intro.webm   # optional, tries first
```

Aim for under about 8 MB. Both files are optional; the app uses `inq-intro.webm` if it plays, then `inq-intro.mp4`, then falls back to the still image with sparks.

## Install

1. Put `inq-intro.mp4` (and/or `.webm`) in `app/intro/`.
2. `npm start` to look at it. Release as usual (`npm run release -- minor "Intro video"`).
3. Nothing in the code changes. Delete the file to go back to the fallback.

Reduced-motion users always get the still image.

## Notes for later

- Accounts are **local to the computer** (password stored as a PBKDF2 hash in the app's local storage; no server, so no password reset, and each computer has its own accounts). Saved progress is not per-account yet. A real online account system would need a backend (for example Supabase or Firebase) and is a separate project.
- The sequence timing is in `play()` in `web/src/intro.js` (background 0.15 s, sparks 0.9 s, logo from 2.6 s, form at 6.4 s). Any click or key skips it.
- Preview in a normal browser by opening the built `app/index.html` with `?intro` on the end.
