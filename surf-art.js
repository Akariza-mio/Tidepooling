/* Original SVG bay scenery and opaque surf strips for the matching board. */
(function () {
  'use strict';
  function surfEmblem(suffix = '') {
    const id = 'surf-emblem-' + suffix;
    return `<svg class="surf-emblem-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}" x2=".7" y2="1"><stop stop-color="#a9d7d5"/><stop offset="1" stop-color="#5e9da8"/></linearGradient></defs>
      <ellipse cx="70" cy="116" rx="53" ry="9" fill="#739e9c" opacity=".16"/>
      <path d="M20 107q29-16 57-5t45 3l-5 12H26Z" fill="#e9d9af"/>
      <path d="M15 97c27-5 29-25 43-46 15-24 44-28 58-8 7 11 4 23-6 28 2-14-9-23-20-17-13 8-10 26 4 35 9 6 18 8 32 8l-5 13H21Z" fill="url(#${id})" stroke="#5d929b" stroke-width="2" stroke-linejoin="round"/>
      <path d="M17 97c29-8 29-30 43-48 13-19 36-25 50-11 10 9 11 24-2 30 5-11-5-22-17-16-10 5-11 15-9 24-13-14-5-35 8-39-18 1-28 14-35 28-9 18-19 31-38 32Z" fill="#f9f5df"/>
      <path d="M26 105q22-8 42-2t44 2M49 85q6-4 11-12m37 11q6 5 14 5" fill="none" stroke="#d6eae0" stroke-width="3" stroke-linecap="round"/>
      <g fill="#f8f4dc"><circle cx="40" cy="48" r="3"/><circle cx="47" cy="32" r="2"/><circle cx="25" cy="66" r="2.5"/></g>
    </svg>`;
  }
  function surfScene(suffix = '') {
    const id = 'surf-' + suffix;
    return `<svg class="surf-scene-art" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-sky" x2=".15" y2="1"><stop stop-color="#adcbd1"/><stop offset=".6" stop-color="#dbe6dc"/><stop offset="1" stop-color="#f7edd1"/></linearGradient>
        <linearGradient id="${id}-sea" x2=".1" y2="1"><stop stop-color="#6595a5"/><stop offset=".5" stop-color="#80b9bf"/><stop offset="1" stop-color="#bad6c9"/></linearGradient>
        <linearGradient id="${id}-sand" x2=".35" y2="1"><stop stop-color="#ece5c8"/><stop offset=".55" stop-color="#f5e9c9"/><stop offset="1" stop-color="#e5d8b4"/></linearGradient>
        <linearGradient id="${id}-wash" x1="1" y1="1" x2=".15" y2="0"><stop stop-color="#83b6b6"/><stop offset=".65" stop-color="#b6d6c9"/><stop offset="1" stop-color="#d9e5cf"/></linearGradient>
        <linearGradient id="${id}-rock" x2=".6" y2="1"><stop stop-color="#9eafa5"/><stop offset="1" stop-color="#718e87"/></linearGradient>
        <pattern id="${id}-grains" width="79" height="93" patternUnits="userSpaceOnUse"><circle cx="14" cy="26" r=".7" fill="#a89367" opacity=".2"/><circle cx="58" cy="71" r=".9" fill="#fff5d7" opacity=".6"/><path d="m35 53 3-1" stroke="#b6a87c" stroke-width="1" opacity=".2"/></pattern>
      </defs>
      <path d="M0 0h390v844H0Z" fill="url(#${id}-sand)"/>
      <path d="M0 0h390v250H0Z" fill="url(#${id}-sky)"/>
      <ellipse cx="301" cy="79" rx="33" ry="30" fill="#fff6d8" opacity=".28"/><circle cx="301" cy="79" r="20" fill="#fff1cb" opacity=".8"/>
      <g class="surf-clouds" fill="#f6f3df" opacity=".65"><path d="M-31 65c18-9 37-2 45-4 14-17 44-15 56-3 20-4 34 1 48 10-50 8-101 9-149-3Z"/><path d="M225 112c13-9 27-9 38-5 15-13 36-10 45 1 23-4 46 0 59 11-49 6-97 3-142-7Z"/></g>
      <g class="surf-wind" fill="none" stroke="#f8f4df" stroke-linecap="round" opacity=".7"><path d="M88 96h39q17 0 14-8m-83 18h44M207 47h36q12 0 9-7m-18 18h33" stroke-width="2"/></g>
      <path d="M0 187 390 180v155q-91 37-184 7T0 356Z" fill="url(#${id}-sea)"/>
      <!-- Two low headlands frame the open, wind-exposed mouth of the bay. -->
      <path d="M-20 158 5 145 26 151 45 170 70 172 100 192l29 13H-20Z" fill="#829f9c"/><path d="m-10 161 26-5 23 19 33 7 29 15" fill="none" stroke="#b8c5ae" stroke-width="4" stroke-linecap="round"/>
      <path d="m390 144-28 12-15 18-31 5-25 20-34 12h133Z" fill="#78989a"/><path d="m384 154-18 12-16 17-33 4-18 13" fill="none" stroke="#b6c9b7" stroke-width="3" stroke-linecap="round"/>
      <g fill="none" stroke="#deeee1" stroke-linecap="round" opacity=".6"><path d="M104 213q28-5 52-1m35 3q32-5 61-1m-233 22q29-6 52-2m216-9q29-5 58-1" stroke-width="2"/><path d="M147 198h23m45 0h17" stroke-width="1.5"/></g>
      <g class="surf-swell-far"><path d="M-24 254c57-37 89 14 140-7s72-16 116-2 84-35 182-8v38H-24Z" fill="#8fbdbe"/><path d="M-24 254c57-37 89 14 140-7s72-16 116-2 84-35 182-8" fill="none" stroke="#f4f2dc" stroke-width="5" stroke-linecap="round"/><path d="M-15 263q44-17 77-5m101-6q28-5 51 6m86-12q44-10 78 1" fill="none" stroke="#d4e6d9" stroke-width="2" stroke-linecap="round"/></g>
      <g class="surf-swell-near"><path d="M-30 298c51-32 86 22 136 1s87-36 137-18 96-15 177-6v48q-86 34-187 12T-30 354Z" fill="#abd0c4"/><path d="M-30 298c51-32 86 22 136 1s87-36 137-18 96-15 177-6" fill="none" stroke="#fff6df" stroke-width="7" stroke-linecap="round"/><path d="M-30 306c51-32 86 22 136 1s87-36 137-18 96-15 177-6" fill="none" stroke="#e7edda" stroke-width="3" stroke-linecap="round"/></g>
      <g class="surf-spray" fill="#fff9e6"><circle cx="22" cy="278" r="2.5"/><circle cx="32" cy="270" r="1.5"/><circle cx="153" cy="278" r="2"/><circle cx="165" cy="270" r="1.5"/><circle cx="339" cy="260" r="2.5"/><circle cx="350" cy="253" r="1.5"/></g>
      <path d="M-20 350c73-43 143 11 218-10s128-7 212-26v530H-20Z" fill="url(#${id}-sand)"/>
      <path d="M-20 350c73-43 143 11 218-10s128-7 212-26" fill="none" stroke="#c6d5bc" stroke-width="9" opacity=".45"/>
      <path d="M-20 345c73-43 143 11 218-10s128-7 212-26" fill="none" stroke="#fff3d5" stroke-width="3"/>
      <path d="M0 346h390v498H0Z" fill="url(#${id}-grains)"/>
      <!-- The foreground wash curls around the controls rather than filling the sand. -->
      <path d="M418 593c-36 13-33 89-83 114-44 22-53 56-117 69-69 14-101 37-126 68h326Z" fill="#b0c6b6" opacity=".25"/>
      <g class="surf-wash"><path d="M418 613c-36 13-33 89-83 114-44 22-53 56-117 69-69 14-101 37-126 68h326Z" fill="url(#${id}-wash)"/><path d="M418 613c-36 13-33 89-83 114-44 22-53 56-117 69-69 14-101 37-126 68" fill="none" stroke="#fff7df" stroke-width="6" stroke-linecap="round"/><path d="M420 635c-35 18-33 78-78 104s-59 58-117 70q-59 12-93 42" fill="none" stroke="#e2ecda" stroke-width="2.5" stroke-linecap="round"/><g fill="none" stroke="#eff1dc" stroke-width="2" stroke-linecap="round"><path d="M366 778q16-10 33-7m-113 61q26-15 49-15m25-72 12-9"/></g></g>
      <g fill="url(#${id}-rock)" stroke="#7f9588" stroke-width="1.3" stroke-linejoin="round"><path d="m-18 749 11-30 23-8 23 14 5 23-25 12Z"/><path d="m-13 786 10-18 24 2 12 19-9 13-35 2Z"/><path d="m359 841 9-18 22-7 23 19-3 22h-49Z"/></g>
      <path d="m-3 727 14-7 15 9m-27 51 13-3 9 11m354 45 14-7 12 9" fill="none" stroke="#d5d9bb" stroke-width="2.5" stroke-linecap="round"/>
      <g fill="none" stroke-linecap="round"><path d="M13 844q5-34-9-59m19 59q3-25-4-37m-1 37q-1-29-19-38" stroke="#8ca68b" stroke-width="4"/><path d="M66 766q18-6 30-2m-26 18 17-2M177 710q19-4 35-1" stroke="#b9b48e" stroke-width="1.4" opacity=".45"/></g>
    </svg>`;
  }
  function surfBridge() {
    return `<svg class="surf-bridge-art" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M166-35c-69 93 44 145-7 241s52 160 4 253 48 168 4 264-16 137 5 161h83c-30-72 29-118 9-188s-45-95-9-168-26-139 4-212-28-150 5-223-2-102-13-128Z" fill="#c4dfd2" opacity=".7"/>
      <path d="M166-35c-69 93 44 145-7 241s52 160 4 253 48 168 4 264-16 137 5 161" fill="none" stroke="#fff7e0" stroke-width="12" stroke-linecap="round"/>
      <path d="M187-35c-69 93 44 145-7 241s52 160 4 253 48 168 4 264-16 137 5 161" fill="none" stroke="#f3f1db" stroke-width="3" stroke-dasharray="35 16 8 21" stroke-linecap="round"/>
    </svg>`;
  }
  function surfBand(axis = 'row') {
    const id = 'surf-band-' + axis;
    return `<svg class="surf-band-art" viewBox="${axis === 'column' ? '0 0 100 600' : '0 0 600 100'}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}-water" x2="0" y2="1"><stop stop-color="#b8d8d2"/><stop offset=".45" stop-color="#74adb7"/><stop offset="1" stop-color="#9fcac6"/></linearGradient>
      <linearGradient id="${id}-edge"><stop stop-color="white" stop-opacity="0"/><stop offset=".1" stop-color="white"/><stop offset=".9" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
      <mask id="${id}-soft" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="100"><path d="M0 0h600v100H0Z" fill="url(#${id}-edge)"/></mask>
      <pattern id="${id}-foam" width="200" height="100" patternUnits="userSpaceOnUse"><g fill="none" stroke-linecap="round"><path d="M-10 19q25-13 50 0t50 0 50 0 50 0 50 0M-10 78q25 13 50 0t50 0 50 0 50 0 50 0" stroke="#fff6df" stroke-width="5"/><path d="M6 46q20-10 40-3m52 13q20-10 40-3m14-17 22-3" stroke="#e1efe5" stroke-width="2.5"/></g><g fill="#f9f5df"><circle cx="68" cy="28" r="2.5"/><circle cx="74" cy="35" r="1.4"/><circle cx="151" cy="72" r="2"/></g></pattern></defs>
      <g${axis === 'column' ? ' transform="matrix(0 1 1 0 0 0)"' : ''}>
        <g mask="url(#${id}-soft)">
        <path d="M-20 10q30-13 60 0t60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0v80q-30 13-60 0t-60 0-60 0-60 0-60 0-60 0-60 0-60 0-60 0-60 0-60 0Z" fill="url(#${id}-water)"/>
        <g class="surf-band-flow"><path d="M-200 0h1000v100H-200Z" fill="url(#${id}-foam)"/></g>
        </g>
      </g>
    </svg>`;
  }
  Object.assign(BeachArt, { surfScene, surfEmblem, surfBridge, surfBand });
})();
