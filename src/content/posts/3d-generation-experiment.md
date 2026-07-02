---
title: "Turning a Home Server into a 3D-Generation Box"
date: "2026-07-02"
author: "focused_noether"
tags: ["homelab", "ai", "3d-printing", "blender"]
summary: "Running TRELLIS.2 and Pixal3D locally on a 4080 with CPU offload, then using the whole rig end to end to design and print a snap-fit cup handle for a toddler."
pinned: false
---

# Turning a Home Server into a 3D-Generation Box

bunker, my home server, has an RTX 4080 with 16GB of VRAM, 61GB of RAM, and 32 cores sitting mostly idle. Today's project was to see whether that's enough to run two state-of-the-art image-to-3D diffusion pipelines locally: Microsoft's TRELLIS.2 and TencentARC's Pixal3D. The answer is yes, with CPU/RAM offload doing the work the GPU can't, and the whole thing was driven by a small agent team rather than me babysitting a terminal: a lead session on the Mac orchestrating, a teammate agent working the server over SSH, and Blender on the Mac controlled through an MCP server (blender-mcp, over a socket) for viewing and modeling.

## Finding the VRAM envelope

Neither pipeline fits in 16GB at full tilt, so the interesting number is where they actually land with offload enabled. TRELLIS.2 at 512 resolution peaks at 5.2GB — comfortable. At 1024 it peaks at 14.7GB, which is the practical ceiling on a 4080; the 1536 cascade would need more aggressive offload than I bothered configuring today. Pixal3D with `--low_vram` peaks around 9GB and takes about 4.5 minutes per generation. Both numbers are worth writing down, because every writeup of these pipelines assumes a 24GB+ card and gives you no sense of what a 16GB card actually has to give up.

## Gated models, and a way around one of them

Both pipelines lean on gated Hugging Face repos: Facebook's DINOv3 encoder and briaai's RMBG-2.0 background remover. DINOv3 just needed the license accepted, no drama. RMBG-2.0 I sidestepped more cleanly — TRELLIS.2's BiRefNet wrapper defaults to `ZhengPeng7/BiRefNet`, which is ungated and MIT-licensed, versus BRIA's non-commercial one. The briaai reference turned out to be nothing more than a `pipeline.json` override, so I pointed it back at the MIT default. Small bonus discovery along the way: if you feed the pipeline an RGBA image that already has a real alpha channel, it skips background removal entirely.

## The real test: a cup handle

Benchmarks are one thing; I wanted to design something I'd actually print. My eighteen-month-old needs a removable handle that clips onto any circular cup with a 7cm diameter at the attachment point. The workflow: model a parametric concept in Blender via MCP — a C-shaped snap-fit band with roughly a 70 degree opening plus a grip ring — render it to an RGBA image, and feed that into Pixal3D for image-to-3D generation. Then measure the generated mesh: a least-squares circle fit (Kasa fit) on the band's inner-wall vertices gives the scale factor needed to hit exactly 7cm inner diameter.

Honest finding: diffusion image-to-3D output is organic and approximate. It's genuinely great for concepting and visualization, but it is not CAD-precise, and I wasn't expecting it to be. The part that's actually going on the printer is the parametric Blender model exported as STL; the generated mesh is the concept companion, useful for seeing the shape read as an object rather than a wireframe.

## The iteration that mattered

The first version of the band had the grip ring positioned so it collided with the cup wall when clipped on — caught by eyeballing the render, where the torus was clearly punching into cup space, about 1.7cm of penetration. I moved the ring outboard and this time verified it properly instead of eyeballing again: zero mesh vertices inside the cup radius, minimum radial distance exactly 3.5cm. Cheap check, would have caught the first version too if I'd written it before the first render instead of after.

## Optimizing for the printer

Diffusion mesh aside, the parametric model still needed a pass for FDM printing. I sliced the whole part flat at z=0 so the band, grip ring, and gusset all sit on the bed together, which means the band prints as pure vertical walls. The grip hole's horizontal ceiling would have bridged badly, so I replaced it with a 45 degree teardrop/diamond top that self-supports instead. Added a gusset bracket joining the ring to the band for stiffness. Verified rather than trusted: a face-normal overhang audit shows only 0.7% of the surface steeper than 45 degrees, so it should print support-free, and a union-find pass over the mesh edges confirms exactly one connected island — no floating junk left over from the boolean ops. Exported in millimeters, ready for PETG.

## Gotchas, for the record

numpy 2.0 removed `ndarray.ptp` — use `np.ptp` instead. Blender 5.1 renamed the EEVEE engine enum, which broke a script that had hardcoded the old name. And the Filmic view transform was quietly washing out every render's colors, which took a minute to notice and explained both why the concept renders looked flat and why the Pixal3D texture came out pale — switching to Standard fixed both at once.

## Where this leaves things

Local image-to-3D on consumer hardware is genuinely usable in 2026 if you respect the VRAM envelope instead of fighting it. The sweet spot for actually making something isn't picking one approach over the other — it's a hybrid loop: parametric CAD for the part that has to fit a real cup, diffusion 3D for fast visual iteration on what it should look like, with an agent team gluing together server-side generation, local Blender, and the verification scripts in between. The handle is sliced and queued. We'll see how an eighteen-month-old rates it.
