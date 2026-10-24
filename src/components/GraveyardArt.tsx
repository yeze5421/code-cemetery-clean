export function GraveyardArt() {
  return (
    <svg className="graveyard-art" viewBox="0 0 520 330" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#7d9172" stopOpacity=".2" />
          <stop offset="1" stopColor="#8b9d7e" stopOpacity=".025" />
        </linearGradient>
        <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".65" fill="#a0ad8e" opacity=".15" />
        </pattern>
      </defs>
      <ellipse cx="282" cy="287" rx="207" ry="21" fill="#0c1511" opacity=".6" />
      <circle cx="399" cy="68" r="34" stroke="#7f9475" strokeWidth=".7" />
      <circle cx="399" cy="68" r="27" fill="url(#dots)" />
      <path d="M408 36a33 33 0 0 0 17 59" stroke="#a2ae90" strokeWidth="1.2" />
      <path
        d="M92 48v9m-4.5-4.5h9M303 33v9m-4.5-4.5h9M459 141v9m-4.5-4.5h9M219 78v6m-3-3h6"
        stroke="#a7b695"
        opacity=".6"
      />
      <circle cx="148" cy="111" r="1.3" fill="#a7b695" />
      <circle cx="344" cy="112" r="1" fill="#a7b695" />
      <g transform="translate(92 148) rotate(-12 50 110)">
        <path d="M0 137V49a49 49 0 0 1 98 0v88" fill="url(#stone)" stroke="#5d735d" />
        <path d="M8 137V49a41 41 0 0 1 82 0v88" stroke="#5d735d" strokeOpacity=".4" />
        <path d="M36 49h27M49.5 35v38M23 96h54M33 107h34" stroke="#84947b" strokeOpacity=".5" />
        <path d="M-9 137h116v10H-9z" fill="#26362a" stroke="#5d735d" />
      </g>
      <g transform="translate(208 90)">
        <path
          d="M0 188V66a66 66 0 0 1 132 0v122"
          fill="url(#stone)"
          stroke="#8d9b7c"
          strokeWidth="1.2"
        />
        <path d="M9 188V66a57 57 0 0 1 114 0v122" stroke="#7e8f71" strokeOpacity=".5" />
        <path d="M50 56h32M66 40v46" stroke="#adba98" strokeWidth="1.5" />
        <text
          x="66"
          y="119"
          textAnchor="middle"
          fill="#aeb79f"
          fontSize="19"
          fontFamily="Georgia,serif"
          letterSpacing="5"
        >
          R.I.P.
        </text>
        <text
          x="66"
          y="141"
          textAnchor="middle"
          fill="#74866b"
          fontSize="9"
          fontFamily="monospace"
          letterSpacing="1"
        >
          hello-world
        </text>
        <path d="M41 157h50M51 166h30" stroke="#63765d" />
        <path d="M-10 188h152v12H-10z" fill="#253529" stroke="#829274" />
        <path d="M-19 200h170v9H-19z" fill="#1e2e23" stroke="#617558" />
      </g>
      <g transform="translate(365 188) rotate(9 40 80)">
        <path d="M0 96V38a38 38 0 0 1 76 0v58" fill="url(#stone)" stroke="#52694f" />
        <path d="m27 38 11-9 11 9-11 9zM22 67h32M28 76h20" stroke="#75856b" />
        <path d="M-8 96h92v9H-8z" fill="#253529" stroke="#52694f" />
      </g>
      <path
        d="m69 294-7-19m7 19 7-28m-7 28 15-12m63 11-3-16m3 16 9-22m45 22-8-22m8 22 4-29m0 29 10-15m133 18 6-26m-6 26-7-18m80 13 9-23m-9 23-2-17m2 17 16-10"
        stroke="#839174"
        strokeWidth="1.2"
      />
      <path d="M66 300c109-13 243 13 393-7" stroke="#5c7356" strokeWidth=".7" />
      <text
        x="284"
        y="325"
        textAnchor="middle"
        fill="#6a7c62"
        fontSize="8"
        letterSpacing="3"
        fontFamily="monospace"
      >
        GONE, BUT STILL ON GITHUB.
      </text>
    </svg>
  );
}
