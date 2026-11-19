# Known issues

- This is a Community Preview candidate tested on a local Windows x64 desktop. Other DPI modes, GPU drivers and multi-monitor combinations remain open for community testing.
- Apparent scale at the end of an action and occasional flicker were reported during late desktop testing. The display keeps the last valid frame during decoder gaps. The static fallback matches the idle size. Visual acceptance of remaining authored pose transitions is pending.
- Transparent playback falls back to the bundled RGBA atlas when the system cannot decode the alpha WebM.
- The executable is unsigned. A signed build has not been prepared.
