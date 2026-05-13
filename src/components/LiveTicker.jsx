// src/components/LiveTicker.jsx
export default function LiveTicker() {
  const tickerItems = [
    { emoji: "🏈", line: "CHIEFS +3", sweating: 241 },
    { emoji: "⚾", line: "YANKEES ML", sweating: 94 },
    { emoji: "🏒", line: "BRUINS -1.5", sweating: 126 },
    { emoji: "🥊", line: "UFC 312 MAIN EVENT", sweating: 389 },
    { emoji: "🏀", line: "LAKERS -5.5", sweating: 187 },
    { emoji: "🏀", line: "LUKA O 30.5 PTS", sweating: 312 },
    { emoji: "⚽", line: "MAN CITY ML", sweating: 156 },
    { emoji: "🏈", line: "BILLS -7.5", sweating: 203 },
  ];

  // Duplicate for seamless loop
  const allItems = [...tickerItems, ...tickerItems];

  return (
    <div className="bg-black border-y border-white/5 py-4 overflow-hidden">
      <div className="animate-ticker flex whitespace-nowrap">
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-8">
            <span className="text-lg">{item.emoji}</span>
            <span className="text-white font-semibold text-sm">{item.line}</span>
            <span className="text-gray-500 text-sm">·</span>
            <span className="text-emerald-brand text-sm font-medium">{item.sweating} SWEATING</span>
          </div>
        ))}
      </div>
    </div>
  );
}
