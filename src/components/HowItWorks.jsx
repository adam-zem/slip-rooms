// src/components/HowItWorks.jsx
export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      title: "DOWNLOAD",
      description: "Grab SlipRooms free on the App Store. Takes 30 seconds.",
    },
    {
      number: "02",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      title: "PICK A LINE",
      description: "Browse live rooms sorted by sport, game, and betting line.",
    },
    {
      number: "03",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      ),
      title: "WALK IN",
      description: "Tap a room. You're instantly in with everyone on the same bet.",
    },
    {
      number: "04",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "SWEAT TOGETHER",
      description: "React in real-time. Celebrate. Commiserate. Never alone again.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <span className="text-emerald-brand text-sm font-medium tracking-wider">THE PROCESS</span>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-3 mb-12">
          HOW IT WORKS.
        </h2>

        {/* Steps grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-emerald-brand/30 transition-colors"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-emerald-brand/10 border border-emerald-brand/30 rounded-xl flex items-center justify-center text-emerald-brand mb-6">
                {step.icon}
              </div>

              {/* Number */}
              <span className="text-emerald-brand text-sm font-medium">{step.number}</span>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mt-2 mb-3">{step.title}</h3>

              {/* Description */}
              <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
