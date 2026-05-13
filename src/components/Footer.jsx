// src/components/Footer.jsx
export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/images/app-icon.png" alt="SlipRooms" className="h-8 w-8" />
            <span className="text-white font-bold text-xl tracking-tight">SlipRooms</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-6 text-sm">
            <a href="/terms.html" className="text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="/privacy.html" className="text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="/faq.html" className="text-gray-400 hover:text-white transition-colors">
              Community Guidelines
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-6 mb-8">
          <p className="text-gray-400 text-sm leading-relaxed">
            <span className="text-white font-semibold">IMPORTANT:</span> SlipRooms is a social community for sports fans to connect and chat. This is <span className="text-white font-semibold">NOT</span> a gambling platform. We do not accept bets, process wagers, or handle any real money transactions. Any references to odds, lines, or bets on this platform are for discussion purposes only. Please gamble responsibly through licensed sportsbooks. You must be 18 years or older to use this app. If you or someone you know has a gambling problem, call <span className="text-white font-semibold">1-800-GAMBLER</span>.
          </p>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <span>Built for the people who sweat.</span>
          <span>© 2026 Pocket Basement LLC. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
