# collage-image-deck — Specification

Which image a cell shows is decided by one global deck, not by the layout and not by per-cell pools. Every cell holds a distinct file, cycling recycles through the deck, and the library is loaded on demand so its size does not bound memory.

## Requirements

### Requirement: One image per cell, no simultaneous duplicates

The system MUST keep every cell's image distinct while the library has at least as many files as cells. At startup the 30 cells SHALL receive 30 distinct images.

#### Scenario: Startup deal
- GIVEN a manifest with 300 files and 30 cells
- WHEN the collage initialises
- THEN each of the 30 cells SHALL hold a different file
- AND `deckFiles()` and the assigned files SHALL be disjoint

### Requirement: The deck is the authority

The rendered image MUST come from the deck. `images/layout.json` SHALL decide geometry only; its `imageFile` field MUST NOT determine what is rendered. After the deal the collage SHALL publish one `image-update` per cell to the bridge, so a phone connecting later receives the image its cell actually shows.

#### Scenario: Phone connects after startup
- GIVEN the collage has dealt 30 distinct images
- WHEN a phone registers onto slot 7
- THEN the bridge SHALL send that phone the image the deck assigned to slot 7

### Requirement: Cycling recycles through the deck

A `cycle-next` action MUST release the cell's image to the bottom of the deck and claim a different unused one. The cell MUST NOT be left without an image while the new bitmap loads.

#### Scenario: Cycle with a 300-image library
- GIVEN slot 4 holds `014.jpg` and 270 files remain in the deck
- WHEN `cycle-next` arrives for slot 4
- THEN slot 4 SHALL hold a file that was not `014.jpg`
- AND `014.jpg` SHALL be at the bottom of the deck
- AND no other cell SHALL hold the new file

### Requirement: Látigo exchanges between cells

The `shuffle` action MUST exchange the images of two cells. It MUST NOT add or remove any file from the deck, so no duplicate can be created and no cell loses its image.

#### Scenario: Shuffle
- GIVEN slots 2 and 9 hold different images
- WHEN `shuffle` arrives for slot 2
- THEN slot 2 SHALL hold slot 9's previous image and slot 9 SHALL hold slot 2's
- AND `deckFiles()` SHALL be unchanged

### Requirement: Bounded memory, no blank cells

Images MUST load on demand. The decoded cache SHALL be bounded by `CONFIG.imageCacheSize` and MUST NOT evict a file that is currently on screen. A cell whose next image is not decoded yet MUST keep showing its current image; the crossfade SHALL start only once the new bitmap is available.

#### Scenario: Slow image
- GIVEN slot 4 is showing `014.jpg`
- WHEN its next image is still downloading
- THEN slot 4 SHALL still render `014.jpg`
- AND no `image-update` SHALL be announced for it yet

#### Scenario: Failed image
- GIVEN slot 4 is showing `014.jpg`
- WHEN `023.jpg` fails to load
- THEN slot 4 SHALL keep `014.jpg` and SHALL NOT become empty

### Requirement: Graceful degradation

With fewer files than cells the deck SHALL be allowed to exhaust: further claims reuse files and log one warning per deck instance. With an empty library every cell SHALL render nothing and nothing SHALL throw.

#### Scenario: Empty manifest
- GIVEN `images/manifest.json` is `{}`
- WHEN the collage initialises
- THEN all 30 cells SHALL have no image and the installation SHALL keep running

### Requirement: Deterministic under an injected source

The deck MUST accept an injected random source and the loader an injected image factory, so both are testable without a browser or a network.
