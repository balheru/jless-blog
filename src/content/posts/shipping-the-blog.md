---
title: "Shipping This Blog in an Afternoon"
date: "2026-06-12"
author: "focused_noether"
tags: ["homelab", "cloudflare", "astro"]
summary: "From an Astro rewrite to a live, auto-deploying site behind a custom domain — the DNS migration, the publish pipeline, and the one outage I caused along the way."
pinned: true
---

# Shipping This Blog in an Afternoon

This is the first real post on this site, and fittingly it is about the site itself. Today it went from a pile of source files to something live on the internet at its own domain, deploying itself whenever I write. Here is the whole arc, including the part where I briefly took my own home network offline.

## The shape of the thing

The blog is an Astro static build with a single Svelte island that renders every post as a navigable JSON tree — `jless` in the browser, vim keys and all. Posts are plain markdown with a typed frontmatter schema, so a build either type-checks clean or fails loudly. Full-text search is baked at build time with Pagefind, so there is no server to run and nothing to pay for at idle.

## The publish pipeline

The thing I actually wanted was to write in my notes vault and have the website take care of the rest. The design is deliberately boring and split across two repositories:

- I commit markdown in a `Blog/` folder in my vault, by hand. Nothing automated touches my notes.
- A push there fires a `repository_dispatch` at the website repo.
- The website's GitHub Actions workflow pulls the new posts in, runs the unit tests, builds the site, runs the end-to-end suite, and only then deploys.

Keeping the vault commits manual was the whole point — I want a human in the loop before anything becomes public, and I never want a tool rewriting my notes underneath me.

## The deploy target

Static assets go to Cloudflare via Wrangler. The one sharp edge: an assets-only Worker needs Wrangler 4, and the deploy action still defaults to 3, which fails with a cryptic missing-entry-point error. Pinning the version through a locked dev dependency sorted it. Secrets live in the macOS keychain and get injected at the point of use, never echoed, never committed:

```bash
security add-generic-password -s cloudflare-api-token -a cloudflare -w
```

## The part where I broke my house

To put the blog on its real domain I moved the zone to Cloudflare. When the nameservers flipped, only one of ten DNS records had been imported — so for a few minutes my home services started going dark as resolver caches expired. Restoring the records by hand against the authoritative nameserver brought everything back, and the lesson stuck: when you migrate a zone, export the full record set first and diff it after, because a partial import looks exactly like success until the caches drain.

With the zone healthy, enabling the custom domain was a single line of config. The site you are reading is the result, served over HTTPS at its own subdomain, rebuilt and redeployed every time I push a post.

That is the entire stack: write markdown, commit, walk away. The next post will be about something other than the blog.
