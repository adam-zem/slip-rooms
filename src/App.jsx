// src/App.jsx
// Marketing landing page for sliprooms.com
import Nav from './components/Nav';
import Hero from './components/Hero';
import LiveTicker from './components/LiveTicker';
import TwoRoomsSection from './components/TwoRoomsSection';
import HowItWorks from './components/HowItWorks';
import ExperienceSection from './components/ExperienceSection';
import SportSelector from './components/SportSelector';
import FreeBanner from './components/FreeBanner';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-black">
      <Nav />
      <Hero />
      <LiveTicker />
      <TwoRoomsSection />
      <HowItWorks />
      <ExperienceSection />
      <SportSelector />
      <FreeBanner />
      <FinalCTA />
      <Footer />
    </div>
  );
}
