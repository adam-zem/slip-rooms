// src/components/FreeBanner.jsx
export default function FreeBanner() {
  const APP_STORE_URL = "https://apps.apple.com/us/app/sliprooms/id6759553452";

  return (
    <section className="bg-emerald-brand py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Left - $0 */}
          <div className="text-6xl sm:text-7xl lg:text-8xl font-black text-white/90">
            $0
          </div>

          {/* Center - Text */}
          <div className="text-center sm:text-left flex-1">
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              FREE TO JOIN. FREE TO SWEAT.
            </h3>
          </div>

          {/* Right - CTA */}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            CLAIM YOUR SEAT
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
