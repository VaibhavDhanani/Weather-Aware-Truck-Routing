from datetime import timedelta
from unittest import mock

from django.test import SimpleTestCase
from django.utils import timezone

from trips.exceptions import ExternalServiceError, LocationNotFound
from trips.utils.plan_trip_utils import PlanTripUtils

URL = '/api/trips/plan/'


def body(**overrides):
    return {
        'origin': 'Denver, CO',
        'destination': 'Chicago, IL',
        'departure': (timezone.now() + timedelta(hours=1)).isoformat(),
        'loadWeightLbs': 42000,
        'intervalMiles': 25,
        **overrides,
    }


class PlanTripApiTests(SimpleTestCase):
    def post(self, data):
        return self.client.post(URL, data, content_type='application/json')

    def test_passes_validated_params_to_planner(self):
        with mock.patch.object(PlanTripUtils, 'plan_trip', return_value={'routes': []}) as plan:
            resp = self.post(body())
        self.assertEqual(resp.status_code, 200)
        kwargs = plan.call_args.kwargs
        self.assertEqual(kwargs['origin'], 'Denver, CO')
        self.assertEqual((kwargs['load_weight_lbs'], kwargs['interval_miles']), (42000, 25))

    def test_validation_errors_have_a_detail_line(self):
        cases = [
            ({'intervalMiles': 30}, 'intervalMiles'),
            ({'loadWeightLbs': 90000}, 'loadWeightLbs'),
            ({'departure': (timezone.now() - timedelta(days=1)).isoformat()}, 'in the past'),
            ({'departure': (timezone.now() + timedelta(days=9)).isoformat()}, 'within 7 days'),
            ({'origin': ''}, 'origin'),
            ({'origin': '39.74, -104.99'}, 'Enter a city name'),  # coordinates are not accepted
            ({'destination': '1600 Pennsylvania Ave'}, 'Enter a city name'),  # nor street addresses
        ]
        for overrides, expected in cases:
            with self.subTest(overrides=overrides):
                resp = self.post(body(**overrides))
                self.assertEqual(resp.status_code, 400)
                self.assertIn(expected, resp.json()['detail'])

    def test_unknown_place_is_422(self):
        with mock.patch.object(PlanTripUtils, 'plan_trip', side_effect=LocationNotFound('Atlantis')):
            resp = self.post(body())
        self.assertEqual(resp.status_code, 422)
        self.assertIn('Atlantis', resp.json()['detail'])

    def test_upstream_failure_is_502(self):
        with mock.patch.object(PlanTripUtils, 'plan_trip', side_effect=ExternalServiceError('Weather service is down.')):
            resp = self.post(body())
        self.assertEqual(resp.status_code, 502)

    def test_cors_allows_vite_dev_server(self):
        resp = self.client.options(
            URL, HTTP_ORIGIN='http://localhost:5175', HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST'
        )
        self.assertEqual(resp.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5175')

    def test_health(self):
        self.assertEqual(self.client.get('/api/health/').json(), {'status': 'ok'})
