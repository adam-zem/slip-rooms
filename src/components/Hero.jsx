// src/components/Hero.jsx
export default function Hero() {
  const APP_STORE_URL = "https://apps.apple.com/us/app/sliprooms/id6759553452";

  return (
    <section className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle glow effect */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-brand/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-brand/30 bg-emerald-brand/10 mb-8">
              <span className="w-2 h-2 bg-emerald-brand rounded-full animate-pulse" />
              <span className="text-emerald-brand text-sm font-medium tracking-wide">NOW LIVE ON iOS</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6">
              <span className="text-white">JOIN A ROOM.</span>
              <br />
              <span className="text-emerald-brand">NEVER SWEAT</span>
              <br />
              <span className="text-white">ALONE AGAIN.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-gray-400 text-lg sm:text-xl max-w-xl mb-8 leading-relaxed">
              Pick a bet. Walk into a room. Sweat it out with hundreds of riders who are locked in on the same line. Real-time. Real reactions. Real community.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-brand hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors"
              >
                GET THE APP
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors"
              >
                HOW IT WORKS
              </a>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-brand" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                FREE DOWNLOAD
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-brand" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                NO WAGERING
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-brand" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                18+
              </span>
            </div>
          </div>

          {/* Right Column - Phone Mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// Phone mockup component with trending rooms
function PhoneMockup() {
  const rooms = [
    { sport: "NBA", quarter: "Q4", time: "2:18", line: "LAKERS -5.5", sweating: 187, live: true },
    { sport: "NBA", quarter: "Q3", time: "8:44", line: "LUKA O 30.5 PTS", sweating: 312, live: true },
    { sport: "MLB", quarter: "BOT 7", time: "", line: "YANKEES ML", sweating: 94, live: true },
    { sport: "NFL", quarter: "Q2", time: "5:01", line: "CHIEFS +3", sweating: 241, live: true },
  ];

  return (
    <div className="relative">
      {/* Phone frame */}
      <div className="w-[280px] sm:w-[320px] bg-[#1a1a1a] rounded-[40px] p-3 border border-white/10 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />

        {/* Screen */}
        <div className="bg-[#0a0a0a] rounded-[32px] overflow-hidden">
          {/* Status bar */}
          <div className="h-12 flex items-end justify-center pb-1">
            <div className="w-20 h-5 bg-black rounded-full" />
          </div>

          {/* App header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm">
              SLIP<span className="text-emerald-brand">ROOMS</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-brand text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-brand rounded-full animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Section label */}
          <div className="px-4 pb-2">
            <span className="text-gray-500 text-xs tracking-wider">TRENDING ROOMS</span>
          </div>

          {/* Room cards */}
          <div className="px-3 pb-6 space-y-2">
            {rooms.map((room, i) => (
              <div
                key={i}
                className="bg-[#141414] rounded-xl p-3 border border-emerald-brand/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-brand text-[10px] font-medium">
                    {room.sport} · {room.quarter} {room.time && `· ${room.time}`}
                  </span>
                  <span className="w-2 h-2 bg-emerald-brand rounded-full animate-pulse" />
                </div>
                <div className="text-white font-semibold text-sm mb-2">{room.line}</div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {[...Array(3)].map((_, j) => (
                      <div
                        key={j}
                        className="w-5 h-5 rounded-full border-2 border-[#141414]"
                        style={{ backgroundColor: ['#047857', '#3b82f6', '#f97316'][j] }}
                      />
                    ))}
                  </div>
                  <span className="text-gray-500 text-xs">{room.sweating} sweating</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom nav */}
          <div className="px-4 py-3 border-t border-white/5 flex justify-around">
            <span className="text-emerald-brand text-xs font-medium">Rooms</span>
            <span className="text-gray-600 text-xs">Floor</span>
            <span className="text-gray-600 text-xs">Score</span>
            <span className="text-gray-600 text-xs">You</span>
          </div>
        </div>
      </div>
    </div>
  );
}
