// Route identity colors, kept clear of the green→red risk scale.
const COLORS = { A: '#2563eb', B: '#8b3fd9', C: '#0e8fa3' }

export const routeColor = (id) => COLORS[id] ?? '#475569'
