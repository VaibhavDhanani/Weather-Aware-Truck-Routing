from datetime import datetime, timedelta, timezone
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase

from trips.constants import METERS_PER_MILE, TRUCK_MAX_MPH
from trips.exceptions import LocationNotFound, RouteNotFound, TripPlanningError
from trips.utils.geo_utils import GeoUtils
from trips.utils.geocoding_utils import GeocodingUtils
from trips.utils.http_utils import HttpUtils
from trips.utils.plan_trip_utils import PlanTripUtils
from trips.utils.risk_utils import RiskUtils
from trips.utils.routing_utils import RoutingUtils
from trips.utils.weather_utils import WeatherUtils

from .fakes import BLIZZARD, CALM, PLACES, fake_fetch_forecast, fake_geocode_city, fake_route_options

NOW = datetime(2026, 10, 12, 15, 20, tzinfo=timezone.utc)

geo_utils = GeoUtils()
risk_utils = RiskUtils()
weather_utils = WeatherUtils()


class GeoUtilsTests(SimpleTestCase):
    def test_haversine_denver_chicago(self):
        self.assertAlmostEqual(geo_utils.haversine_miles((-104.99, 39.74), (-87.63, 41.88)), 920, delta=5)

    def test_interpolate_numbers_and_points(self):
        cum = [0, 10, 30]
        self.assertEqual(geo_utils.interpolate(cum, [0, 1, 3], 20), 2)
        self.assertEqual(geo_utils.interpolate(cum, [(0, 0), (10, 0), (30, 0)], 5), (5, 0))
        self.assertEqual(geo_utils.interpolate(cum, [0, 1, 3], 99), 3)

    def test_offset_point_round_trip(self):
        start = (-95.0, 40.0)
        moved = geo_utils.offset_point(start, 90, 100)
        self.assertAlmostEqual(geo_utils.haversine_miles(start, moved), 100, delta=0.5)
        self.assertAlmostEqual(geo_utils.bearing(start, moved), 90, delta=1)


class RiskUtilsTests(SimpleTestCase):
    @staticmethod
    def level(load=20_000, **weather):
        return risk_utils.assess_risk({'windMph': 0, 'rainInHr': 0, 'snowInHr': 0, **weather}, load)['level']

    def test_wind_thresholds(self):
        self.assertEqual(
            [self.level(windMph=mph) for mph in (24, 25, 34, 35, 44, 45, 54, 55)],
            ['low', 'moderate', 'moderate', 'high', 'high', 'severe', 'severe', 'no_travel'],
        )

    def test_rain_thresholds(self):
        self.assertEqual(
            [self.level(rainInHr=r) for r in (0.09, 0.10, 0.24, 0.25, 0.49, 0.50, 1.00, 1.01)],
            ['low', 'moderate', 'moderate', 'high', 'high', 'severe', 'severe', 'no_travel'],
        )

    def test_snow_thresholds(self):
        self.assertEqual(
            [self.level(snowInHr=s) for s in (0.4, 0.5, 0.9, 1.0, 1.9, 2.0, 3.0, 3.1)],
            ['low', 'moderate', 'moderate', 'high', 'high', 'severe', 'severe', 'no_travel'],
        )

    def test_load_rules(self):
        self.assertEqual(self.level(windMph=55, load=1_000), 'no_travel')  # any load
        self.assertEqual(self.level(windMph=50, load=30_000), 'severe')
        self.assertEqual(self.level(windMph=50, load=30_001), 'no_travel')
        self.assertEqual(self.level(windMph=40, load=40_000), 'high')
        self.assertEqual(self.level(windMph=40, load=40_001), 'severe')
        self.assertEqual(self.level(windMph=30, load=80_000), 'moderate')  # below the load-rule bands

    def test_worst_input_wins_and_factors_explain_it(self):
        result = risk_utils.assess_risk({'windMph': 30, 'rainInHr': 0.3, 'snowInHr': 0}, 20_000)
        self.assertEqual(result['level'], 'high')
        self.assertEqual(result['factors'], ['Wind 30 mph → Moderate', 'Rain 0.3 in/hr → High'])
        self.assertEqual(result['score'], round((30 / 55 * 0.30 + 0.3 / 1.0 * 0.30) * 100))

    def test_weighted_score_scales_caps_and_weights(self):
        score = risk_utils.weighted_score
        self.assertEqual(score({'windMph': 0, 'rainInHr': 0, 'snowInHr': 0}), 0)
        self.assertAlmostEqual(score({'windMph': 55, 'rainInHr': 1.0, 'snowInHr': 3.0}), 1.0)
        self.assertAlmostEqual(score({'windMph': 110, 'rainInHr': 0, 'snowInHr': 0}), 0.30)  # capped at 1 before weighting
        self.assertAlmostEqual(score({'windMph': 0, 'rainInHr': 0, 'snowInHr': 1.5}), 0.20)

    def test_route_risk_counts_miles_at_the_worse_end(self):
        cps = [{'mile': m, 'risk': {'level': lvl, 'score': sc}} for m, lvl, sc in
               [(0, 'low', 0), (25, 'severe', 75), (50, 'low', 0), (60, 'high', 50)]]
        route = risk_utils.route_risk(cps)
        self.assertEqual(route['riskLevel'], 'severe')
        self.assertEqual(route['milesByLevel'], {'low': 0, 'moderate': 0, 'high': 10, 'severe': 50, 'no_travel': 0})
        self.assertEqual(route['riskScore'], round((0 + 75 + 0 + 50) / 4))

    def test_recommendation_order(self):
        def route(no_travel=0, severe=0, high=0, score=0, minutes=600):
            miles = {'low': 0, 'moderate': 0, 'high': high, 'severe': severe, 'no_travel': no_travel}
            return {'milesByLevel': miles, 'riskScore': score, 'durationMinutes': minutes}

        def best(*routes):
            return min(routes, key=risk_utils.recommendation_key)

        a, b = route(severe=10, minutes=500), route(high=200, minutes=900)
        self.assertIs(best(a, b), b)  # fewest severe miles beats time and high miles
        a, b = route(severe=0, no_travel=5), route(severe=300)
        self.assertIs(best(a, b), b)  # any no-travel mileage loses
        a, b = route(high=10, score=10), route(high=20, score=0)
        self.assertIs(best(a, b), a)  # then fewest high miles
        a, b = route(score=20), route(score=10, minutes=900)
        self.assertIs(best(a, b), b)  # then lowest average risk
        a, b = route(minutes=700), route(minutes=650)
        self.assertIs(best(a, b), b)  # then shortest time


class WeatherUtilsTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_rain_and_snow_rates(self):
        w = weather_utils.to_weather({**CALM, 'rain': 0.2, 'showers': 0.05, 'snowfall': 1.25})
        self.assertEqual((w['rainInHr'], w['snowInHr']), (0.25, 1.25))

    def test_units_and_condition(self):
        w = weather_utils.to_weather({**CALM, 'visibility': 10560})
        self.assertEqual(w['visibilityMi'], 2.0)
        self.assertEqual((w['precipType'], w['condition']), ('none', 'Clear'))

    def test_precip_types(self):
        to = weather_utils.to_weather
        self.assertEqual(to(BLIZZARD)['precipType'], 'snow')
        self.assertEqual(to({**CALM, 'weather_code': 66, 'precipitation': 0.05})['precipType'], 'ice')
        self.assertEqual(to({**CALM, 'weather_code': 63, 'precipitation': 0.2})['precipType'], 'rain')
        self.assertEqual(to({**CALM, 'weather_code': 61, 'precipitation': 0.05, 'temperature_2m': 30})['precipType'], 'ice')

    def test_calm_sky_with_strong_wind_reads_high_wind(self):
        self.assertEqual(weather_utils.to_weather({**CALM, 'wind_speed_10m': 35})['condition'], 'High Wind')

    def test_fetch_dedupes_points_into_grid_cells_and_caches(self):
        start = NOW.replace(minute=0)
        points = [(-100.01, 40.01), (-100.02, 40.02), (-90.0, 35.0)]  # first two share a cell

        def payload(url, params, **kwargs):
            n = len(params['latitude'].split(','))
            return [{'hourly': {var: [CALM[var]] * 49 for var in CALM}} for _ in range(n)]

        with mock.patch.object(HttpUtils, 'get_json', side_effect=payload) as get:
            forecast = weather_utils.fetch_forecast(points, start, 48)
            self.assertEqual(len(get.call_args.args[1]['latitude'].split(',')), 2)
            weather_utils.fetch_forecast(points, start, 48)
            self.assertEqual(get.call_count, 1)  # second call served from cache
        self.assertEqual(forecast.at(-100.01, 40.01, start + timedelta(hours=3))['condition'], 'Clear')
        self.assertTrue(forecast.covers(start + timedelta(hours=48)))
        self.assertFalse(forecast.covers(start + timedelta(hours=50)))


class RoutingUtilsTests(SimpleTestCase):
    @staticmethod
    def _osrm_route(coords, name='I 80', secs_per_seg=600.0):
        n = len(coords) - 1
        dist = [geo_utils.haversine_miles(a, b) * METERS_PER_MILE for a, b in zip(coords, coords[1:])]
        return {
            'geometry': {'coordinates': [list(c) for c in coords]},
            'duration': secs_per_seg * n,
            'legs': [{'summary': name, 'annotation': {'distance': dist, 'duration': [secs_per_seg] * n}}],
        }

    def test_parse_caps_truck_speed_and_names_route(self):
        coords = [(-100.0, 40.0), (-99.0, 40.0)]  # ~53 miles in 10 minutes -> capped at 65 mph
        opt = RoutingUtils()._parse(self._osrm_route(coords))
        self.assertEqual(opt.name, 'via I 80')
        self.assertAlmostEqual(opt.duration_hours, opt.distance_miles / TRUCK_MAX_MPH, places=3)

    def test_remove_via_spike(self):
        coords = [(0, 0), (1, 0), (1, 1), (1, 2), (1, 1.0000001), (1, 0.0000001), (2, 0)]
        seg = [1.0] * 6
        c, m, h = RoutingUtils()._remove_via_spike(coords, seg, seg, boundary=3)
        self.assertEqual(c, [(0, 0), (1, 0), (1, 0.0000001), (2, 0)])
        self.assertEqual((len(m), len(h)), (len(c) - 1, len(c) - 1))

    def test_adds_detours_until_three_options(self):
        o, d = PLACES['denver'], PLACES['chicago']
        direct = [(o.lon, o.lat), (d.lon, d.lat)]

        def fetch(points, alternatives):
            if alternatives:
                return [self._osrm_route(direct)]
            return [self._osrm_route([points[0], points[1], points[2]], name='US 6')]

        with mock.patch.object(RoutingUtils, '_fetch', side_effect=fetch):
            options = RoutingUtils().get_route_options(o, d)
        self.assertEqual(len(options), 3)
        self.assertEqual(options[0].name, 'via I 80')  # fastest first

    def test_no_route(self):
        with mock.patch.object(RoutingUtils, '_fetch', return_value=[]):
            with self.assertRaises(RouteNotFound):
                RoutingUtils().get_route_options(PLACES['denver'], PLACES['chicago'])


class GeocodingUtilsTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_city_coordinates_never_expire(self):
        hit = [{'lon': '-104.98', 'lat': '39.74', 'display_name': 'Denver, Colorado, United States'}]
        with mock.patch.object(GeocodingUtils, '_search_city', return_value=hit), \
                mock.patch('trips.utils.geocoding_utils.cache.set') as cache_set:
            GeocodingUtils().geocode_city('Denver, CO')
        self.assertIsNone(cache_set.call_args.args[2])  # timeout None = no expiry

    def test_city_lookup_is_cached(self):
        hit = [{'lon': '-104.98', 'lat': '39.74', 'display_name': 'Denver, Colorado, United States'}]
        with mock.patch.object(GeocodingUtils, '_search_city', return_value=hit) as search:
            geocoding_utils = GeocodingUtils()
            first = geocoding_utils.geocode_city('Denver, CO')
            second = geocoding_utils.geocode_city('  denver, co ')
        search.assert_called_once()
        self.assertEqual((first.lat, first.lon), (second.lat, second.lon))

    def test_unknown_city(self):
        with mock.patch.object(GeocodingUtils, '_search_city', return_value=[]):
            with self.assertRaises(LocationNotFound):
                GeocodingUtils().geocode_city('Atlantis')


@mock.patch.object(WeatherUtils, 'fetch_forecast', side_effect=fake_fetch_forecast)
@mock.patch.object(RoutingUtils, 'get_route_options', side_effect=fake_route_options)
@mock.patch.object(GeocodingUtils, 'geocode_city', side_effect=fake_geocode_city)
class PlanTripUtilsTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def _plan(self, **overrides):
        params = dict(
            origin='Denver', destination='Chicago', departure=NOW + timedelta(hours=1),
            load_weight_lbs=42_000, interval_miles=25, now=NOW,
        )
        return PlanTripUtils().plan_trip(**{**params, **overrides})

    def test_response_matches_frontend_contract(self, *_):
        plan = self._plan()
        self.assertEqual(
            set(plan),
            {'origin', 'destination', 'departure', 'loadWeightLbs', 'intervalMiles', 'fastestRouteId',
             'safestRouteId', 'recommendedRouteId', 'recommendationReason', 'routes', 'heatmap'},
        )
        route = plan['routes'][0]
        self.assertEqual(
            set(route),
            {'id', 'name', 'geometry', 'distanceMiles', 'durationMinutes', 'departure', 'arrival', 'riskScore',
             'riskLevel', 'milesByLevel', 'summary', 'checkpoints'},
        )
        cp = route['checkpoints'][0]
        self.assertEqual(set(cp), {'index', 'mile', 'lon', 'lat', 'eta', 'inForecastWindow', 'weather', 'risk'})
        self.assertEqual(plan['heatmap']['forecastStart'], '2026-10-12T15:00:00Z')
        self.assertEqual(len(plan['heatmap']['points'][0]['values']), 49)

    def test_checkpoints_follow_interval_and_eta(self, *_):
        route = self._plan(interval_miles=50)['routes'][0]
        miles = [c['mile'] for c in route['checkpoints']]
        self.assertEqual(miles[:3], [0, 50, 100])
        self.assertEqual(miles[-1], route['distanceMiles'])
        self.assertEqual(route['checkpoints'][0]['eta'], '2026-10-12T16:20:00Z')
        self.assertEqual(route['arrival'], route['checkpoints'][-1]['eta'])

    def test_recommends_around_the_storm(self, *_):
        plan = self._plan()
        by_id = {r['id']: r for r in plan['routes']}
        self.assertEqual(plan['fastestRouteId'], 'A')
        severe = {r['id']: r['milesByLevel']['severe'] for r in plan['routes']}
        self.assertEqual(by_id['B']['riskLevel'], 'severe')  # B bulges through the blizzard
        self.assertEqual(plan['recommendedRouteId'], min(severe, key=severe.get))  # fewest severe miles wins
        self.assertNotEqual(plan['recommendedRouteId'], 'B')
        self.assertIn('Fewest Severe miles', plan['recommendationReason'])

    def test_identical_requests_reuse_the_cached_plan(self, geocode, *_):
        first = self._plan()
        second = self._plan(origin='  denver ')  # same trip, differently typed
        self.assertEqual(first, second)
        self.assertEqual(geocode.call_count, 2)  # only the first request did any work
        self._plan(load_weight_lbs=10_000)  # a different request is planned afresh
        self.assertEqual(geocode.call_count, 4)

    def test_same_origin_and_destination(self, *_):
        with self.assertRaises(TripPlanningError):
            self._plan(destination='Denver')
