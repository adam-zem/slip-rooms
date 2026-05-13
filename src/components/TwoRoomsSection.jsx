// src/components/TwoRoomsSection.jsx
export default function TwoRoomsSection() {
  const features = [
    {
      number: "01",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: "ROOMS",
      description: "Live chat rooms for every line, every game. Walk in, lock in, and ride the sweat with everyone on your side of the bet.",
      tagline: "REAL-TIME REACTIONS. NO DELAY.",
    },
    {
      number: "02",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      ),
      title: "THE FLOOR",
      description: "A Twitter-style social feed built exclusively for sports bettors. Post your picks, debate the sharps, build your reputation.",
      tagline: "YOUR FEED. YOUR TAKES.",
    },
  ];

  return (
    <section id="rooms" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <span className="text-emerald-brand text-sm font-medium tracking-wider">THE PLATFORM</span>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-3 mb-12">
          TWO ROOMS. ONE MOVEMENT.
        </h2>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.number}
              className="relative bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 overflow-hidden group hover:border-emerald-brand/30 transition-colors"
            >
              {/* Background number */}
              <div className="absolute top-4 right-4 text-8xl font-black text-white/5 select-none">
                {feature.number}
              </div>

              {/* Icon */}
              <div className="w-12 h-12 bg-emerald-brand/10 border border-emerald-brand/30 rounded-xl flex items-center justify-center text-emerald-brand mb-6">
                {feature.icon}
              </div>

              {/* Number label */}
              <span className="text-emerald-brand text-sm font-medium">{feature.number}</span>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white mt-2 mb-4">{feature.title}</h3>

              {/* Description */}
              <p className="text-gray-400 leading-relaxed mb-6">{feature.description}</p>

              {/* Tagline */}
              <span className="text-emerald-brand text-sm font-semibold tracking-wide">
                {feature.tagline}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
