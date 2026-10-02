# Bleach Filler Radar

A Chrome extension that watches the Disney+ player and tells you whether the
Bleach episode you just started is filler, mixed canon/filler, or manga canon.

## What it does

- A toast slides in at the top right when an episode starts. The toast names the
  status and says when canon resumes.
- The toolbar icon carries a letter for the current tab: `F` filler, `M` mixed,
  `C` canon.
- Clicking the icon shows the status of the current episode, the run it belongs
  to, and how many episodes away the next filler and next mixed runs are.

Canon episodes stay quiet by default. Untick "Only pop up for filler and mixed"
in the popup to get a short green toast on canon episodes too.

## Install

1. Open `chrome://extensions`.
2. Turn on Developer mode, top right.
3. Click "Load unpacked" and pick this folder.
4. Open an episode on Disney+.

## How it finds the episode

The Disney+ title bug holds a subtitle like `S1:E10 Episode 10`. The element
sits inside a shadow root under the `<title-bug>` custom element, so the content
script walks open shadow roots to reach it.

The title bug hides itself a few seconds after playback starts. Detection runs
at two speeds to work around that:

- A fast poll every 750 ms for 90 seconds after every URL change.
- A slow poll every 3 seconds after that, forever, in case the bug comes back.
- A `MutationObserver` on the title bug's shadow root, so an insertion is caught
  without waiting for the next poll.
- The fast window re-arms on `play`, `seeked`, and the tab becoming visible.

The last good reading is cached against the player URL, so the popup still
answers long after the title bug has gone.

## Season numbering

Disney+ numbers episodes inside a season. The filler list numbers them across
the whole show, 1 to 366. The extension converts one to the other with a table
of season starting points:

| Season | Starts at | Season | Starts at |
| ------ | --------- | ------ | --------- |
| 1      | 1         | 9      | 168       |
| 2      | 21        | 10     | 190       |
| 3      | 42        | 11     | 206       |
| 4      | 64        | 12     | 213       |
| 5      | 92        | 13     | 230       |
| 6      | 110       | 14     | 266       |
| 7      | 132       | 15     | 292       |
| 8      | 152       | 16     | 317       |

If Disney+ splits the seasons differently, the popup fixes it. Open
"Numbering", type the real episode number, and press Save. The extension shifts
that one season and leaves the rest alone. "Reset season offsets" puts the table
back.

If Disney+ numbers episodes absolutely instead, tick "Disney+ already numbers
these absolutely" and the season table is ignored.

## Series check

Thousand-Year Blood War is numbered separately and has no filler, so the
extension stays dormant unless the page mentions Bleach and does not mention
Thousand-Year Blood War. Tick "Run even if the page does not say Bleach" to
override.

## Files

| File           | Job                                                        |
| -------------- | ---------------------------------------------------------- |
| `manifest.json`| MV3 manifest, scoped to `https://*.disneyplus.com/*`        |
| `episodes.js`  | The filler list and the lookup helpers, shared by both ends |
| `content.js`   | Reads the title bug, shows the toast                        |
| `background.js`| Sets the toolbar badge per tab                              |
| `popup.*`      | The panel shown when you click the icon                     |

## Episode data

Transcribed from the animefillerlist.com quick list: 162 manga canon, 41 mixed,
163 filler, covering every episode from 1 to 366 with no gaps.
