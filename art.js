/* Original, lightweight SVG shore finds. No external images or requests. */
(function (root) {
  'use strict';
  const palettes = [
    ['#f5b9a6', '#d26d60', '#ffe5ce'],
    ['#b7d4c5', '#628f83', '#e7f2dd'],
    ['#f2d18d', '#bc9050', '#fff1bd'],
    ['#c8b8d8', '#8b75a3', '#f2dff2']
  ];
  const names = ['珊瑚扇贝', '薄荷小螃蟹', '奶油小虾', '丁香八爪鱼'];
  const shapes = [
    // Keep the original pink scallop illustration unchanged.
    '<path d="M49 83C29 77 11 56 12 36 13 26 22 26 25 22 31 15 35 21 39 15 44 8 56 8 61 15 65 21 70 15 76 22 79 27 88 26 89 36 91 54 72 78 52 83Z"/><g class="ribs"><path d="M49 79 21 32M50 78 32 24M50 78 44 17M51 78 57 17M52 79 69 25M53 79 81 33"/></g><path class="highlight" d="M19 40Q48 25 81 40M25 57Q51 45 76 57"/>',
    // Rounded pincers, walking legs and raised eyes make a friendly mint crab.
    '<g fill="none" stroke-width="3" stroke-linecap="round"><path d="M29 55 18 55 13 62m17 0-13 5-3 7m21-6-11 7-1 7M71 55h11l5 7m-17 0 13 5 3 7m-21-6 11 7 1 7M28 50q-9-3-10-13m54 13q9-3 10-13"/></g><path d="M18 41C5 40 3 26 11 19l7 9 8-8c8 9 5 20-8 21Zm64 0c13-1 15-15 7-22l-7 9-8-8c-8 9-5 20 8 21Z"/><path d="M25 57c0-12 10-19 25-19s25 7 25 19c0 12-11 19-25 19S25 69 25 57Z"/><path class="ribs" d="m39 41-2-9m24 9 2-9"/><g fill="#fffaf0" stroke-width="1.5"><circle cx="37" cy="31" r="5.5"/><circle cx="63" cy="31" r="5.5"/></g><g class="eyes"><circle cx="38" cy="31" r="2.3"/><circle cx="62" cy="31" r="2.3"/></g><path class="smile" d="M45 57q5 6 10 0"/><g class="blush"><ellipse cx="36" cy="57" rx="4.5" ry="2.7"/><ellipse cx="64" cy="57" rx="4.5" ry="2.7"/></g><path class="highlight" d="M33 48q9-7 20-6M12 29l3 4"/>',
    // A curled butter-yellow shrimp with a fan tail and delicate antennae.
    '<g class="ribs" stroke-linecap="round"><path d="M71 29q12-19 22-13M73 33q15-9 21-1M37 73l-4 10m14-8 1 11m9-15 6 9"/></g><path d="M62 65q12-11 23-3l-9 10 13 6q-8 13-25 2l-7-9Z"/><path d="M77 38C73 18 47 12 29 27 9 43 14 66 31 77c15 10 36 4 38-8 2-9-8-14-15-10-4 3-3 9-11 8-10 0-17-10-12-19 4-9 15-10 23-4 8 6 21 7 23-6Z"/><path d="m73 30 15 7-13 4"/><path class="ribs" d="M25 32q5 7 13 10M19 43q8 6 13 8M20 56l11 2m-5 11 9-6m4 15 4-11m9 12 1-11m11 5-8-5m11-2 9 6"/><circle class="eyes" cx="65" cy="31" r="2.8"/><circle fill="#fffaf1" stroke="none" cx="65.7" cy="30.2" r=".8"/><ellipse class="blush" cx="68" cy="39" rx="4" ry="2.2"/><path class="highlight" d="M33 27q13-8 25-2M22 43q-3 8 1 14"/>',
    // Eight softly curled arms sit behind a friendly lavender head.
    '<path d="M32 46C20 49 7 42 12 35c5-7 14-3 11 4l11 2Zm-1 6C19 57 6 54 9 45c2-8 13-7 13 0l12 1Zm2 7C22 73 8 69 13 59c3-7 11-6 12 0l12-7Zm9 4C38 81 24 85 22 74c-2-8 7-12 10-5l4-12Zm9 1c3 16-7 28-14 20-5-6 0-15 5-10l2-13Zm9-2c8 13 6 27-4 23-8-3-7-12 0-11l-4-13Zm8-8c15 4 23 17 13 21-8 3-13-5-7-9l-12-6Zm2-10c15-2 26 6 20 14-6 7-14 1-10-5l-13 1Z"/><path d="M28 48c-3-14 0-32 21-33 22-1 27 17 24 32-1 13-11 20-23 20S29 60 28 48Z"/><g class="eyes"><ellipse cx="40" cy="42" rx="2.6" ry="3.5"/><ellipse cx="60" cy="42" rx="2.6" ry="3.5"/></g><g fill="#fffaf1" stroke="none"><circle cx="40.7" cy="40.9" r=".9"/><circle cx="60.7" cy="40.9" r=".9"/></g><path class="smile" d="M46 49q4 5 8 0"/><g class="blush"><ellipse cx="34" cy="49" rx="4.3" ry="2.6"/><ellipse cx="66" cy="49" rx="4.3" ry="2.6"/></g><path class="highlight" d="M35 31q4-10 14-10"/><g fill="#f2dfed" stroke="none" opacity=".7"><circle cx="17" cy="61" r="1.6"/><circle cx="27" cy="76" r="1.6"/><circle cx="40" cy="81" r="1.6"/><circle cx="61" cy="80" r="1.6"/><circle cx="81" cy="69" r="1.6"/></g>'
  ];
  function item(index, suffix = '') {
    const [base, dark, light] = palettes[index];
    const id = 's' + index + '-' + suffix;
    return `<svg class="shell-art seaside-item" data-kind="${index}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><g fill="url(#${id})" stroke="${dark}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shapes[index]}</g><style>.seaside-item .ribs{fill:none;stroke-width:2.3;opacity:.65}.seaside-item .highlight{fill:none;stroke:#fff9ee;stroke-width:2.8;opacity:.65}.seaside-item .eyes{fill:#4d5d58;stroke:none}.seaside-item .smile{fill:none;stroke:#647365;stroke-width:1.8}.seaside-item .blush{fill:#e8a1a0;stroke:none;opacity:.55}</style></svg>`;
  }
  root.BeachArt = { item, names };
})(globalThis);
