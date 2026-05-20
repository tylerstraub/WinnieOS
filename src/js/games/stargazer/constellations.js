/**
 * Stargazer constellation library
 *
 * Each entry:
 *   name   — display name (rendered as "The {name}")
 *   length — number of stars (must equal stars.length); also = digit-sequence length
 *   stars  — pattern in normalized coords. xN ∈ [0..1] across width, yN ∈ [0..1]
 *            within the sky region (the game maps this into the canvas).
 *   edges  — pairs of star indices to connect on reveal
 *
 * Design notes for adding new constellations:
 *   - Aim for shapes a 4–5 year old can recognize (animals, objects from her world).
 *   - Use the full sky width; xN ~ 0.2 to 0.8 reads best after the per-night
 *     scale/flip jitter.
 *   - yN above 0.7 starts to crowd the horizon — keep most stars above 0.65.
 *   - 3..7 stars are common; 8..9 appear as rare "Great Constellations" (~10%).
 *   - "Great Constellations" should feel mythic — long curves, big spans.
 */

export const CONSTELLATIONS = [
    // ── 3 stars ───────────────────────────────────────────────────────────
    {
        name: 'Tea Cup',
        length: 3,
        stars: [
            { xN: 0.35, yN: 0.55 },
            { xN: 0.50, yN: 0.32 },
            { xN: 0.65, yN: 0.55 },
        ],
        edges: [[0, 1], [1, 2], [0, 2]],
    },
    {
        name: 'Pebbles',
        length: 3,
        stars: [
            { xN: 0.30, yN: 0.62 },
            { xN: 0.50, yN: 0.55 },
            { xN: 0.70, yN: 0.65 },
        ],
        edges: [[0, 1], [1, 2]],
    },
    {
        name: 'Acorn',
        length: 3,
        stars: [
            { xN: 0.36, yN: 0.38 },
            { xN: 0.64, yN: 0.38 },
            { xN: 0.50, yN: 0.66 },
        ],
        edges: [[0, 1], [1, 2], [2, 0]],
    },

    // ── 4 stars ───────────────────────────────────────────────────────────
    {
        name: 'Kite',
        length: 4,
        stars: [
            { xN: 0.50, yN: 0.22 },
            { xN: 0.67, yN: 0.45 },
            { xN: 0.50, yN: 0.68 },
            { xN: 0.33, yN: 0.45 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    {
        name: 'Little Boat',
        length: 4,
        stars: [
            { xN: 0.42, yN: 0.30 },
            { xN: 0.42, yN: 0.55 },
            { xN: 0.66, yN: 0.55 },
            { xN: 0.54, yN: 0.70 },
        ],
        edges: [[0, 1], [1, 2], [1, 3], [2, 3]],
    },
    {
        name: 'Window',
        length: 4,
        stars: [
            { xN: 0.35, yN: 0.32 },
            { xN: 0.65, yN: 0.32 },
            { xN: 0.65, yN: 0.62 },
            { xN: 0.35, yN: 0.62 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    {
        name: 'Bunny',
        length: 4,
        stars: [
            { xN: 0.42, yN: 0.28 },
            { xN: 0.58, yN: 0.28 },
            { xN: 0.50, yN: 0.48 },
            { xN: 0.50, yN: 0.68 },
        ],
        edges: [[0, 2], [1, 2], [2, 3]],
    },

    // ── 5 stars ───────────────────────────────────────────────────────────
    {
        name: 'Crown',
        length: 5,
        stars: [
            { xN: 0.22, yN: 0.55 },
            { xN: 0.36, yN: 0.30 },
            { xN: 0.50, yN: 0.55 },
            { xN: 0.64, yN: 0.30 },
            { xN: 0.78, yN: 0.55 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]],
    },
    {
        name: 'Big Star',
        length: 5,
        stars: [
            { xN: 0.50, yN: 0.22 },
            { xN: 0.74, yN: 0.42 },
            { xN: 0.65, yN: 0.68 },
            { xN: 0.35, yN: 0.68 },
            { xN: 0.26, yN: 0.42 },
        ],
        // Classic 5-pointed star order — every other point.
        edges: [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]],
    },
    {
        name: 'Little Fish',
        length: 5,
        stars: [
            { xN: 0.30, yN: 0.50 },
            { xN: 0.45, yN: 0.40 },
            { xN: 0.60, yN: 0.50 },
            { xN: 0.45, yN: 0.62 },
            { xN: 0.74, yN: 0.50 },
        ],
        edges: [[0, 1], [1, 2], [2, 4], [2, 3], [3, 0]],
    },

    // ── 6 stars ───────────────────────────────────────────────────────────
    {
        name: 'Cat',
        length: 6,
        stars: [
            { xN: 0.40, yN: 0.28 },
            { xN: 0.60, yN: 0.28 },
            { xN: 0.50, yN: 0.42 },
            { xN: 0.50, yN: 0.58 },
            { xN: 0.34, yN: 0.66 },
            { xN: 0.66, yN: 0.66 },
        ],
        edges: [[0, 2], [1, 2], [2, 3], [3, 4], [3, 5]],
    },
    {
        name: 'House',
        length: 6,
        stars: [
            { xN: 0.50, yN: 0.22 },
            { xN: 0.32, yN: 0.40 },
            { xN: 0.68, yN: 0.40 },
            { xN: 0.32, yN: 0.66 },
            { xN: 0.68, yN: 0.66 },
            { xN: 0.50, yN: 0.66 },
        ],
        edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [5, 4]],
    },
    {
        name: 'Butterfly',
        length: 6,
        stars: [
            { xN: 0.50, yN: 0.42 },
            { xN: 0.50, yN: 0.58 },
            { xN: 0.28, yN: 0.30 },
            { xN: 0.28, yN: 0.60 },
            { xN: 0.72, yN: 0.30 },
            { xN: 0.72, yN: 0.60 },
        ],
        edges: [[0, 1], [0, 2], [1, 3], [0, 4], [1, 5]],
    },

    // ── 7 stars ───────────────────────────────────────────────────────────
    {
        name: 'Big Bear',
        length: 7,
        stars: [
            { xN: 0.22, yN: 0.35 },
            { xN: 0.36, yN: 0.30 },
            { xN: 0.56, yN: 0.36 },
            { xN: 0.76, yN: 0.34 },
            { xN: 0.70, yN: 0.60 },
            { xN: 0.46, yN: 0.62 },
            { xN: 0.24, yN: 0.62 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
    },
    {
        name: 'Castle',
        length: 7,
        stars: [
            { xN: 0.18, yN: 0.50 },
            { xN: 0.28, yN: 0.28 },
            { xN: 0.40, yN: 0.50 },
            { xN: 0.55, yN: 0.28 },
            { xN: 0.66, yN: 0.50 },
            { xN: 0.82, yN: 0.28 },
            { xN: 0.50, yN: 0.66 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 6], [5, 6]],
    },
    {
        name: 'Tea Pot',
        length: 7,
        stars: [
            { xN: 0.30, yN: 0.40 },
            { xN: 0.55, yN: 0.40 },
            { xN: 0.55, yN: 0.62 },
            { xN: 0.30, yN: 0.62 },
            { xN: 0.18, yN: 0.50 },
            { xN: 0.66, yN: 0.50 },
            { xN: 0.42, yN: 0.30 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [3, 4], [1, 5], [2, 5], [0, 6]],
    },

    // ── 8 stars — rare "Great Constellation" ──────────────────────────────
    {
        name: 'Sleeping Otter',
        length: 8,
        stars: [
            { xN: 0.14, yN: 0.55 },
            { xN: 0.26, yN: 0.45 },
            { xN: 0.36, yN: 0.40 },
            { xN: 0.48, yN: 0.42 },
            { xN: 0.60, yN: 0.40 },
            { xN: 0.72, yN: 0.50 },
            { xN: 0.82, yN: 0.62 },
            { xN: 0.64, yN: 0.66 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
    },

    // ── 9 stars — rare "Great Constellation" ──────────────────────────────
    {
        name: 'Dragon',
        length: 9,
        stars: [
            { xN: 0.12, yN: 0.50 },
            { xN: 0.22, yN: 0.38 },
            { xN: 0.34, yN: 0.46 },
            { xN: 0.44, yN: 0.32 },
            { xN: 0.54, yN: 0.46 },
            { xN: 0.66, yN: 0.32 },
            { xN: 0.78, yN: 0.46 },
            { xN: 0.58, yN: 0.62 },
            { xN: 0.74, yN: 0.66 },
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [7, 8]],
    },
];
