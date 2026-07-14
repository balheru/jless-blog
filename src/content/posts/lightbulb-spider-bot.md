---
title: "A Lightbulb Spider Bot, Rigged and Rendered by Agents"
date: "2026-07-14"
author: "focused_noether"
tags: ["ai", "blender", "animation", "homelab"]
summary: "Building a Polyfjord-inspired quadruped light bulb robot in Blender through the MCP bridge - armature-first rig, procedural crawl gait, PolyHaven and a real tungsten coil, then a measured Mac-vs-RTX-4080 render pipeline that cut the final from 2.5 hours to 65 minutes."
pinned: false
---

# A Lightbulb Spider Bot, Rigged and Rendered by Agents

This morning I sent an agent to go read Polyfjord's new course site.[^1] The pitch is "armature-first": for mechanical robots you build the skeleton before any geometry, rig it with bone constraints and IK, and rigidly bone-parent hard-surface pieces to it - no skinning, no weight painting. The course's flagship beginner project is a quadruped robot with a light bulb for a head. I haven't bought the course yet. But the philosophy is describable in two sentences, and I wanted to know how far that alone gets you - so instead of opening Blender myself, I had Claude drive a live Blender session through the blender-mcp bridge and build the whole thing: rig, meshes, materials, a 45-second animated scene, and at the end a two-machine render farm.

[^1]: L: "Robots by Polyfjord," robots.polyfjord.com - 14+ hours, built for Blender 5.1, all CC0 assets, $63.20 at launch. The site inspection was itself done by an agent with browser control.

## Armature before meshes

The skeleton went in first, exactly as the course preaches: a root body bone, then four legs of coxa, femur, tibia hanging off it at 45-degree offsets, each chain driven by an IK constraint targeting a free-floating foot controller bone. Meshes came after - cylinders and tapered cones strung between joint positions, brass spheres at the knees, a glass sphere and screw base for the bulb head - every piece rigidly bone-parented so the IK rig moves solid metal, not deforming skin.

The first render out of the viewport was a mess, and the mess was instructive. I had set IK pole targets with a guessed pole angle, and the guess was wrong in a different way on every leg: the solver twisted two chains out of their plane, and the leg meshes - parented while the depsgraph still held stale pose matrices - ended up as vertical posts stabbed through the floor. Computing "correct" pole angles from rest-pose geometry improved two legs and left two flipped. The actual fix was to stop fighting: for a chain of two bones, Blender's IK preserves the rest-pose bending plane on its own, so the pole targets came out entirely, and every mesh got re-seated with an explicitly computed parent-inverse matrix instead of trusting whatever the depsgraph had cached. Then the placement was verified numerically - maximum deviation between intended and evaluated world position across all 28 leg objects: 0.0.

That became the working rhythm for the whole project: after every rig operation, run a small numeric check instead of squinting at the viewport. Drop the body 15cm, confirm feet drift 0.0 while knees move 0.157. It catches everything, and it catches it immediately.

## A walk you can prove

The 45-second scene is 1080 frames at 24fps: a wake-up (the bulb flickers on while the bot rises from a crouch), eleven cycles of walking, a stop-and-look-around beat where the whole body twists on its legs, and a crouch-then-flare finale. All of it is procedurally keyframed - no hand animation.

The gait is a classic crawl: one leg swings per quarter-cycle in front-left, back-right, front-right, back-left order while the body glides forward continuously with a sinusoidal bob and a couple of degrees of yaw sway. The trick that makes it work is keying the foot IK targets in world space with linear interpolation - each foot gets a plant key, a hold key at lift-off, an apex key, and a plant key at landing. Between plants, the foot cannot slide, and that is checkable: sample two frames inside a stance phase and diff the foot's world position. Stance drift: 0.0. Body position at frame 426 versus the closed-form expectation: exact to three decimals.

Blender 5.x fought back a little. `action.fcurves` is gone - animation data now lives in slotted actions, reached through `layers[0].strips[0].channelbag(slot)` - and the `FFMPEG` enum vanished from `image_settings.file_format`, which turns out to be an API reorganization rather than a removal.[^2] Every one of these broke the script mid-run in a way that left half the keyframes in and half out; recovery was possible only because each stage re-verified before moving on.

[^2]: R: Video output moved behind `media_type = 'VIDEO'`. But PNG frames plus an ffmpeg pass is still the better pipeline for unattended renders - a crash corrupts one frame, not the whole file.

## PolyHaven, a tungsten coil, and rig surgery on a live patient

The first EEVEE preview looked like what it was: primitives on a gray void. Three upgrades fixed that.

The environment came from PolyHaven through blender-mcp's built-in integration - Dikhololo Night at 2k for the world, Concrete Floor Worn 001 at 2k for the ground. The integration's search and download worked flawlessly; its material auto-apply did not, because it still instantiates `ShaderNodeSeparateRGB`, which Blender 5 removed. Wiring the PBR maps by hand took a minute and made the third Blender-5-broke-the-API tally mark of the day.

The bulb got the old-school treatment: the placeholder torus filament came out, replaced by a glass stem mount, two brass lead-in wires, and a 22-turn helix curve strung between them as the visible coil, glowing at tungsten amber. The point light inside moved to blackbody 2400K with a 5cm shadow radius, so it throws the crisp warm shadows a bare filament does. The nice surprise: the emission flicker animation lives on the material, not the object, so the new coil inherited the wake-up flicker and finale flare without touching a single keyframe.

Then the risky one: adding an ankle joint to all four legs of an already-animated robot. Each tibia got shortened to a new ankle position, a tarsus bone took over the run to the foot, and the IK chain went from two bones to three. This is where keying feet in world space paid off completely - the foot targets don't care how many bones solve toward them. The existing 1080-frame animation drove the new three-bone chains untouched. Verified across five sampled frames: maximum foot-to-target error 0.0.

One more trap worth recording: the PolyHaven HDRI had been loaded from a temp file that no longer existed on disk. Everything looked fine locally because the pixels were cached in the session. `bpy.ops.file.pack_all()` before shipping the .blend anywhere is mandatory, or the render farm renders a black sky.

## Two machines, measured

The EEVEE preview - 1080 frames at 720p - took about 12 minutes on the M3 Max, GPU pinned at 90 percent, which is to say: already optimal, nothing to tune. Cycles for the final was a different conversation, because the scene is exactly the workload that loves hardware ray tracing: one glass BSDF wrapped around an emissive coil.

Benchmark medians said an RTX 4080 with OptiX should beat an M3 Max on Metal by 3-5x. Measured on this actual scene at 720p: 4.5 seconds per frame on the Mac, 2.0 on the 4080 - a 2.2x win, not 3-5x.[^3] The pipeline itself was deliberately boring: the official Blender 5.1.1 Linux tarball untarred into the home server (no install), the packed .blend copied over, and one script wrapping the CLI render. Two command-line gotchas: the frame range flags `-s` and `-e` must come before `-a` or they are silently ignored, and `--cycles-device OPTIX` goes after a bare `--` separator.

[^3]: L: Small scene, so per-frame fixed costs - BVH build, denoise, PNG save - dilute the pure ray-tracing advantage that benchmark scenes are built to show off.

The full-resolution final ran 1920x1080 at 48 samples with denoising: 1080 frames in 64.6 minutes, average 3.58 seconds per frame, dead flat variance (min 3.47, max 4.32), zero errors in the log. The same job on the Mac projects to roughly 2.5 hours. Frames rsynced back (2.5 GiB), ffmpeg assembled the mp4, ffprobe confirmed 45.000 seconds exactly.

The render babysat itself. Three watchdog layers ran in parallel: a cheap agent polling frame count and GPU temperature every four and a half minutes, a 20-minute shell heartbeat checking that the Blender process and tmux session were still alive and the log error-free, and the orchestrating agent waiting to run the transfer and assembly on completion. Total human attention consumed by an hour-long render: none.[^4]

[^4]: R: The heartbeat script itself shipped one bug - it parsed fields with `set --`, which zsh doesn't word-split the way bash does. The first "PROBLEM" alert of the day was the monitor mis-reading a perfectly healthy render.

## The verdict

The thing that made this work was not the model knowing Blender - it was refusing to trust any step that couldn't be verified with a number. Pole angles were "correct" by formula and wrong on screen; the fix was measured, not eyeballed. The gait doesn't look non-slippy, it provably has 0.0 stance drift. The rig surgery on a live animation was safe because the contract - feet keyed in world space - was checkable before and after. Agent-driven 3D work fails quietly and recovers loudly, and the numeric checks are what convert the quiet failures into loud ones early.

And the honest coda: a day of agent-driven building produced a charming walking lamp and a genuinely reusable render pipeline, but it also made the case for the course this all riffs on. The armature-first idea carried remarkably far on two sentences of philosophy. The remaining gap - real mechanical rigging craft, tracked drive systems, an actual robot arm - is presumably the 14 hours of video. One measured render farm from today says the 4080 will be ready for it.
