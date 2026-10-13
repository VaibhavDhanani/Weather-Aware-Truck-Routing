import { PLAN_PATH, RISK_LEVELS } from '../constants'

const FEATURES = [
  {
    title: 'Weather at your ETA',
    text: 'Forecast wind, rain and snow at a checkpoint every 10, 25 or 50 miles, for the hour your truck actually gets there.',
  },
  {
    title: 'Load-aware risk',
    text: 'Heavy loads in strong wind are rated higher, so a 40,000 lb trailer gets a different answer than an empty one.',
  },
  {
    title: 'One clear pick',
    text: 'Three routes compared by miles in severe weather, average risk and drive time, with the reason for the recommendation.',
  },
]

const CTA = 'rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent/90'

export default function LandingPage() {
  return (
    <div className="min-h-full bg-surface">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-bold">Weather-Aware Truck Routing</span>
        <a href={PLAN_PATH} className="font-semibold text-accent hover:underline">
          Open planner →
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center desk:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight desk:text-5xl">
            Pick the safest route before the truck leaves
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Enter two cities, a departure time and the load. Get three routes rated by the weather the truck will
            drive through, and the one we recommend.
          </p>
          <a href={PLAN_PATH} className={`${CTA} mt-8 inline-block`}>
            Plan a route
          </a>

          <ul className="mt-12 flex flex-wrap justify-center gap-2" aria-label="Risk levels">
            {RISK_LEVELS.map((level) => (
              <li
                key={level.key}
                className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: level.color }}
              >
                {level.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 pb-16 desk:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-[10px] border border-line bg-page p-5">
              <h2 className="font-bold">{feature.title}</h2>
              <p className="mt-2 text-muted">{feature.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Routes by OSRM · Forecasts by Open-Meteo · Map data © OpenStreetMap contributors
      </footer>
    </div>
  )
}
