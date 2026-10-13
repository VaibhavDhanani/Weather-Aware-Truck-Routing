"""Weather risk per checkpoint and per route, using the provided risk/load rules
(tables in trips/constants.py)."""

from trips.constants import (
    LOAD_RULES,
    RAIN_RULES,
    RECOMMENDATION_LEVELS,
    RISK_LEVEL_LABELS,
    RISK_LEVELS,
    RISK_SCORE_WEIGHTS,
    SNOW_RULES,
    WIND_RULES,
)


class RiskUtils:
    def assess_risk(self, weather, load_lbs):
        """{level, score, factors} for one hour of weather at one point.

        The level is the worst of wind, rain and snow; load rules can only raise it.
        `score` is the weighted risk score as 0–100. `factors` explains every input
        that pushed the level above low.
        """
        wind, rain, snow = weather['windMph'], weather['rainInHr'], weather['snowInHr']
        candidates = [
            (self._level_for(wind, WIND_RULES), f'Wind {wind} mph'),
            (self._level_for(rain, RAIN_RULES), f'Rain {rain} in/hr'),
            (self._level_for(snow, SNOW_RULES), f'Snow {snow} in/hr'),
        ]
        for min_mph, max_mph, over_lbs, level in LOAD_RULES:
            if min_mph <= wind <= max_mph and load_lbs > over_lbs:
                candidates.append((level, f'Wind {wind} mph with a load over {over_lbs:,} lb'))

        level = self.worst_level(lvl for lvl, _ in candidates)
        factors = [
            f'{reason} → {RISK_LEVEL_LABELS[lvl]}'
            for lvl, reason in candidates
            if lvl != 'low'
        ]
        return {'level': level, 'score': round(self.weighted_score(weather) * 100), 'factors': factors}

    def weighted_score(self, weather):
        """0–1: wind/55, rain/1.0 and snow/3 (each capped at 1), weighted 0.30/0.30/0.40."""
        return sum(min(weather[field] / scale, 1.0) * weight for field, scale, weight in RISK_SCORE_WEIGHTS)

    def worst_level(self, levels):
        return max(levels, key=RISK_LEVELS.index, default='low')

    def route_risk(self, checkpoints):
        """Route-level summary: worst level, average weighted score and miles at each level.

        Each stretch between two checkpoints counts at the worse of its two ends.
        """
        miles_by_level = dict.fromkeys(RISK_LEVELS, 0.0)
        for a, b in zip(checkpoints, checkpoints[1:]):
            miles_by_level[self.worst_level([a['risk']['level'], b['risk']['level']])] += b['mile'] - a['mile']
        scores = [c['risk']['score'] for c in checkpoints]
        return {
            'riskLevel': self.worst_level(c['risk']['level'] for c in checkpoints),
            'riskScore': round(sum(scores) / len(scores)) if scores else 0,
            'milesByLevel': {level: round(miles) for level, miles in miles_by_level.items()},
        }

    def recommendation_key(self, route):
        """Sort key, best first: fewest No Travel / Severe / High miles, then lowest
        average risk, then shortest travel time."""
        return (
            *(route['milesByLevel'][level] for level in RECOMMENDATION_LEVELS),
            route['riskScore'],
            route['durationMinutes'],
        )

    def _level_for(self, value, rules):
        for level, threshold, inclusive in rules:
            if value > threshold or (inclusive and value == threshold):
                return level
        return 'low'
