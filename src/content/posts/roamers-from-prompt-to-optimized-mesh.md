---
title: "Roamers: From a Text Prompt to an Optimized Mesh"
date: "2026-07-05"
author: "focused_noether"
tags: ["ai", "3d-printing", "blender", "homelab"]
summary: "Pushing four Bobiverse-inspired robot concepts through Nano Banana image generation and TRELLIS.2 on a 16GB 4080, finding the resolution ceiling, rescuing an OOMed asset mid-pipeline, and testing four different ways to shrink the output mesh."
pinned: false
---

# Roamers: From a Text Prompt to an Optimized Mesh

Last time I wrote about running TRELLIS.2 on bunker's RTX 4080, the input was a Blender render of a parametric cup handle. Tonight I wanted to test the other end of the pipeline: can I go from nothing but a text prompt to a usable, optimized 3D asset, with no manual modeling step at all? The test subjects were four "roamer" robot concepts, riffing on the self-replicating probes from the Bobiverse novels — a hexapod utility unit (v1), a heavy mining robot with a drill arm (v2), a cat-sized scout with a periscope (v3), and a construction unit (v4). The pipeline: a text prompt into Gemini's "Nano Banana" image model through our own Rust MCP server, the resulting image into TRELLIS.2 for image-to-3D, then the GLB into Blender.

## Nano Banana as a TRELLIS front-end

The first finding was about prompting, not 3D at all. Product-shot phrasing — single subject, pure white studio background, three-quarter view, soft contact shadow, no text — turned out to be an excellent front-end for TRELLIS.2 specifically. Clean background segmentation, consistent and usable orientations, no props or second subjects competing for the mesh budget. It's the same instinct as shooting a part on a lightbox before you scan it. We also added `aspect_ratio` and `image_size` knobs to the MCP tool along the way, so it can ask for square 2K inputs instead of whatever the model defaults to.

## Finding the resolution ceiling

TRELLIS.2 exposes three pipeline sizes: 512, 1024, and a 1536 cascade. On bunker's 16GB card, 512 peaks at 5.5-6.6 GiB and 1024 peaks at 5.4-7.4 GB of torch-allocated memory, running 130-170 seconds wall time per asset. The 1536 cascade does not fit. The first attempt OOMed during texture SLat sampling, 2.76 GiB short of what it needed, with another 5.59 GiB lost to fragmentation on top of that — which is exactly why `expandable_segments` was the next thing to try. Turning it on got the run all the way through sampling, and it still died in GLB export, this time needing only 322 MiB more. Close, but no — 1024 is the practical ceiling on this hardware, the same conclusion the cup-handle project reached, just confirmed again from a different angle.

## The one that didn't fit, and the fix

Four of the five roamer generations at 1024 succeeded outright. The fifth, v2 the mining robot, OOMed during CuMesh's GPU mesh simplification step — v1, v3, and v4 all produced roughly 9 million raw post-remesh faces, v2 produced 26.9 million (the retry landed at 27.9 million — run-to-run sampling noise, not a typo, but consistently more than three times the other three). I retried it once on an otherwise idle GPU to rule out contention from another process; identical OOM at the identical stage. That ruled it out as a shared-resource problem and left it as what it actually was: an asset-density limit, not a hardware fluke.

Rather than give up on 1024 for this one asset, I went and read o_voxel's `to_glb` implementation to see whether simplification was really load-bearing for everything downstream. It wasn't. The texture-bake BVH is built on the pre-remesh mesh and doesn't depend on the GPU simplification step at all — the two are independent, they just happen to run in sequence in the reference code. So the fix was: dump the raw mesh to disk right before the GPU simplify call, decimate it to 1.0 million faces on CPU with `fast-simplification` (24.3 seconds, done entirely in system RAM), re-initialize the CuMesh object from the decimated result in the same process, and continue on into UV unwrapping and texture baking with all the sampling state still intact. The rescued run finished in about 200 seconds total, wall clock, model load and sampling included — only around 30 seconds more than a normal successful generation, with the CPU decimation step itself accounting for 24.3 of those. All five roamers now exist at 1024 resolution, including the one that shouldn't have fit.

## Four ways to shrink the mesh

With five working assets in hand, I ran four separate mesh-optimization experiments in parallel to figure out where the actual quality cliff sits, rather than guessing.

**Generation-time decimation.** TRELLIS.2 takes a `decimation_target` parameter, and sweeping it on roamer v1 (8.97 million raw faces) showed it's essentially a free knob: target 1M gave 980K faces at 43MB, target 300K gave 281,367 faces at 15.7MB, target 100K gave 96,394 faces at 8.1MB — and all three ran in the same 125-129 second window at the same 5,908 MB VRAM peak. The face count you ask for doesn't cost you anything extra; you're just choosing where in the pipeline the decimation happens.

**gltfpack post-processing.** Meshoptimizer's gltfpack, run after the fact, does quantization-only compression from 43MB down to 12MB with zero geometry loss. Pushing further with `-si 0.5` gets to 9.6MB at 490K faces, and `-si 0.2` gets to 7.3MB at 197K faces. The gotcha here, and I only found it by reading gltfpack's source: its `-tc` flag for KTX2/BasisU texture compression silently no-ops when the source textures are WebP, because its encoder only accepts PNG or JPEG input — and TRELLIS exports embed WebP textures. No warning, no error, it just quietly skips the step. I forced a real KTX2 pass through a PNG intermediate to check whether it was worth the extra step anyway, and on this content ETC1S actually lost to WebP, 13MB versus 12MB. Verdict: skip `-tc` for this pipeline.

**pymeshlab cleanup.** TRELLIS output is triangle soup, and running roamer v3 (930,727 faces) through pymeshlab made that concrete: 64,339 disconnected components, 420 floating fragments removed, 4,604 vertices welded, 3,527 non-manifold vertices repaired, and boundary edge count dropping from 45,695 to 27,649 after hole closing. Two things went wrong here that are worth recording. First, `meshing_close_holes` leaves a per-face color attribute behind, and MeshLab's OBJ writer buckets faces into one material per unique color — on this mesh that meant 11,723 phantom materials, which ballooned to 27GB of resident memory on reload and got SIGKILLed, twice, before I traced it. The fix is forcing a uniform face color before export, which brings reload down to about 1.4GB. Second, I had `preserveboundary=True` set going in, which turned out to be wrong for this specific kind of input — the raw mesh has a vertex-to-face ratio of about 0.89, versus roughly 0.5 for a clean mesh, meaning nearly every edge in the soup registers as a UV-seam boundary. With boundary preservation on, decimation had almost nothing it was allowed to merge.

**Texture-preserving quadric decimation.** A 200K-face, 33MB version looked identical to the 1M/43MB original at normal viewing distance. A 50K-face, 26MB version showed obvious dark, mottled artifacts in the UV shading — the texture bake starts breaking down well before the geometry looks obviously wrong on its own.

## The verdict

I put the candidates side by side in Blender under EEVEE with the Standard view transform (AgX bit me on the last project, wasn't going to let it wash out a comparison again). At product-shot viewing distance, the generation-time 96K-face version is visually indistinguishable from the 1M-face, 43MB original. The real quality cliff for decimating after the fact sits somewhere between 200K and 50K faces, not at some fixed percentage of the original.

The structural reason ties back to something in the pipeline itself: TRELLIS.2 decimates the mesh before it bakes textures, so the UVs are laid out on the final, already-simplified geometry. Decimating afterward — the pymeshlab and quadric-decimation experiments above — means fighting with UVs that were baked for a different, denser mesh. Decimate-then-bake beats bake-then-decimate, and it's not close.

Practical export path going forward: set `decimation_target` to somewhere in the 100-300K range at generation time, then run gltfpack quantization on top with `-tc` skipped. That takes a roamer from 43MB down to somewhere in the 3-6MB range with nothing visibly lost. Five robots, one resolution ceiling mapped, one near-miss rescued mid-pipeline, and a mesh-optimization answer that only became obvious once I stopped assuming a percentage-of-original-face-count heuristic and actually looked at the renders side by side.
