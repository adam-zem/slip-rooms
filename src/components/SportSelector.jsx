// src/components/SportSelector.jsx
export default function SportSelector() {
  const sports = [
    { name: "NBA", emoji: "🏀", inRooms: "2,847" },
    { name: "NFL", emoji: "🏈", inRooms: "1,932" },
    { name: "MLB", emoji: "⚾", inRooms: "1,204" },
    { name: "NHL", emoji: "🏒", inRooms: "876" },
    { name: "SOCCER", emoji: "⚽", inRooms: "1,543" },
    { name: "UFC", emoji: "🥊", inRooms: "2,108" },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <span className="text-emerald-brand text-sm font-medium tracking-wider">SELECT SPORT</span>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mt-3 mb-12">
          PICK YOUR POISON.
        </h2>

        {/* Sport grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {sports.map((sport) => (
            <div
              key={sport.name}
              className="group bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 hover:border-emerald-brand/30 rounded-2xl p-6 text-center transition-all cursor-pointer"
            >
              <div className="text-4xl mb-3">{sport.emoji}</div>
              <div className="text-white font-bold text-lg mb-1">{sport.name}</div>
              <div className="text-gray-500 text-sm">{sport.inRooms} IN ROOMS</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
