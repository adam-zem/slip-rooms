// src/components/FinalCTA.jsx
export default function FinalCTA() {
  const APP_STORE_URL = "https://apps.apple.com/us/app/sliprooms/id6759553452";

  const stats = [
    { value: "∞", label: "ROOMS PER NIGHT" },
    { value: "15+", label: "SPORTS LIVE" },
    { value: "$0", label: "COST TO YOU" },
    { value: "iOS", label: "LIVE NOW" },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle glow effect */}
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-brand/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div className="relative z-10">
            {/* Section label */}
            <span className="text-emerald-brand text-sm font-medium tracking-wider">DOWNLOAD</span>

            {/* Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-3 mb-6">
              THE ROOM IS OPEN.
            </h2>

            {/* Subheadline */}
            <p className="text-gray-400 text-lg max-w-lg mb-8">
              We built the app we wished existed. Now it's yours.
            </p>

            {/* App Store buttons */}
            <div className="flex flex-wrap gap-4 mb-12">
              {/* App Store */}
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-xl transition-colors"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs">Download on the</div>
                  <div className="text-lg font-semibold -mt-0.5">App Store</div>
                </div>
              </a>

              {/* Google Play - Coming Soon */}
              <div className="inline-flex items-center gap-3 bg-gray-800 text-gray-400 px-6 py-3 rounded-xl cursor-not-allowed opacity-60">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs">Coming Soon</div>
                  <div className="text-lg font-semibold -mt-0.5">Google Play</div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#0d0d0d] border border-white/10 rounded-xl p-4"
                >
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-brand mb-1">
                    {stat.value}
                  </div>
                  <div className="text-gray-500 text-xs tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Phone Mockup */}
          <div className="flex justify-center lg:justify-end">
            <FloorPhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// Phone mockup showing The Floor
function FloorPhoneMockup() {
  const posts = [
    {
      user: "rtkid",
      color: "#f97316",
      time: "2m",
      content: "Locked in LAKERS -5.5 tonight. Room is about to be insane. #nobodysweatsalone",
      likes: 47,
      comments: 12,
    },
    {
      user: "doubleK",
      color: "#eab308",
      time: "8m",
      content: "Been in the room every night this week. The grind is real. #sliprooms",
      likes: 89,
      comments: 23,
    },
    {
      user: "slowburn",
      color: "#22c55e",
      time: "15m",
      content: "First night on SlipRooms. Cubs ML room had me screaming at my phone. This app is different. 🔥",
      likes: 134,
      comments: 31,
    },
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
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
            <span className="text-white font-bold text-lg">THE FLOOR</span>
            <span className="text-emerald-brand text-xs font-medium">TRENDING</span>
          </div>

          {/* Posts */}
          <div className="divide-y divide-white/5">
            {posts.map((post, i) => (
              <div key={i} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: post.color }}
                  >
                    {post.user[0].toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold text-sm">{post.user}</span>
                      <span className="text-gray-600 text-xs">{post.time}</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed mb-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-gray-600 text-xs">
                      <span className="flex items-center gap-1">
                        <span>♥</span> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <span>💬</span> {post.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom nav */}
          <div className="px-4 py-3 border-t border-white/5 flex justify-around">
            <span className="text-gray-600 text-xs">Rooms</span>
            <span className="text-emerald-brand text-xs font-medium">Floor</span>
            <span className="text-gray-600 text-xs">Score</span>
            <span className="text-gray-600 text-xs">You</span>
          </div>
        </div>
      </div>
    </div>
  );
}
