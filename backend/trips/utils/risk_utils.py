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
        return sum(min(weather[field] / scale, 1.0) * weight for field, scale, weight in RISK_SCORE_WEIGHTS)

    def worst_level(self, levels):
        return max(levels, key=RISK_LEVELS.index, default='low')

    def route_risk(self, checkpoints):
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
