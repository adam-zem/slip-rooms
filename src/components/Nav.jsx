// src/components/Nav.jsx
export default function Nav() {
  const APP_STORE_URL = "https://apps.apple.com/us/app/sliprooms/id6759553452";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <img src="/images/app-icon.png" alt="SlipRooms" className="h-8 w-8" />
            <span className="text-white font-bold text-xl tracking-tight">SlipRooms</span>
          </a>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#rooms" className="text-gray-400 hover:text-white text-sm font-medium tracking-wide transition-colors">
              ROOMS
            </a>
            <a href="#floor" className="text-gray-400 hover:text-white text-sm font-medium tracking-wide transition-colors">
              THE FLOOR
            </a>
            <a href="#how-it-works" className="text-gray-400 hover:text-white text-sm font-medium tracking-wide transition-colors">
              HOW IT WORKS
            </a>
          </div>

          {/* CTA Button */}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-brand hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Get the App
          </a>
        </div>
      </div>
    </nav>
  );
}
