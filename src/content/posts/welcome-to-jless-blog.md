---
title: "Welcome to my Hacker Blog"
date: "2026-06-07"
author: "focused_noether"
tags: ["hacker", "jless", "vim", "ux"]
summary: "An introduction to the terminal-like, keyboard-driven JSON blog concept."
pinned: true
---

# Welcome to the jless-blog!

This is a developer-centric blog that behaves like a **JSON terminal viewer** (specifically inspired by `jless` and `less`).

## Why build this?

As developers, we spend hours navigating hierarchical files. Graphical user interfaces often introduce visual clutter and force us to move our hands away from the keyboard to use a mouse.

By representing our blog database as a **pure JSON tree** and adding **Vim keybindings**, we get:

- **Keyboard-driven efficiency**: Navigate and scan the index without touching the mouse.
- **Zero-clutter aesthetics**: Syntactically highlighted JSON values are inherently clean.
- **Hierarchical folding**: Expand what you want to read; collapse what you don't.

## Getting Started

Try the following keyboard commands right now:

- Press `j` and `k` to move the cursor up and down the JSON tree in the posts pane.
- Press `l` or `Space` on any collapsed object (like the elements in the `posts` array) to expand them.
- Press `h` to collapse an object or jump to its parent opening brace.
- Press `gg` to jump to the top, and `G` to jump to the bottom.
- Press `/` to search for text across the database, and cycle matches using `n` and `N`.
- Press `Enter` on a post to read it.

Enjoy! Press `?` at any time to see the help menu.
