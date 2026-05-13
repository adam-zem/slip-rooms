// src/components/ExperienceSection.jsx
export default function ExperienceSection() {
  const bullets = [
    "Real-time chat synced to live game clocks",
    "Reactions, memes, and pure unfiltered energy",
    "Everyone in the room is on the same line",
    "No trolls from the other side — just your people",
  ];

  return (
    <section id="floor" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div>
            {/* Section label */}
            <span className="text-emerald-brand text-sm font-medium tracking-wider">THE EXPERIENCE</span>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mt-3 mb-8 leading-tight">
              IT'S LIKE BEING AT THE BAR WITH THE ONLY PEOPLE WHO GET IT.
            </h2>

            {/* Bullets */}
            <ul className="space-y-4">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-emerald-brand rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-400 text-lg">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column - Chat Preview */}
          <div className="flex justify-center lg:justify-end">
            <ChatPreviewMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// Chat preview mockup component
function ChatPreviewMockup() {
  const messages = [
    { user: "jakemoves", color: "#047857", message: "AD just checked back in let's GOOO 🔥🔥" },
    { user: "rtkid", color: "#f97316", message: "bro if they cover this im naming my kid LeBron" },
    { user: "doubleK", color: "#eab308", message: "defense is clamping rn. -5.5 is alive. HOLD." },
    { user: "slowburn", color: "#22c55e", message: "i cant watch. someone tell me when its over 😭" },
    { user: "jakemoves", color: "#047857", message: "LMAOOO we're all in this together 💀" },
  ];

  return (
    <div className="w-full max-w-md">
      {/* Chat container */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-brand rounded-full animate-pulse" />
              <span className="text-emerald-brand text-sm font-semibold">LIVE</span>
            </span>
            <span className="text-white font-bold">LAKERS -5.5</span>
          </div>
          <div className="text-gray-500 text-sm">
            Q4 · 2:18 <span className="ml-2">187 IN ROOM</span>
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: msg.color }}
              >
                {msg.user[0].toUpperCase()}
              </div>

              {/* Message content */}
              <div>
                <span className="text-white font-semibold text-sm">{msg.user}</span>
                <p className="text-gray-300 text-sm mt-0.5">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-gray-500 text-sm">Type a message...</span>
            <svg className="w-5 h-5 text-emerald-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
