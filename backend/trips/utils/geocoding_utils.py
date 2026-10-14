import hashlib
import logging
import threading
import time
from dataclasses import asdict, dataclass

from django.conf import settings
from django.core.cache import cache

from trips.constants import GEOCODE_CACHE_SECONDS, GEOCODING_SERVICE, NOMINATIM_MIN_INTERVAL_SECONDS
from trips.exceptions import LocationNotFound
from trips.utils.http_utils import HttpUtils

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Place:
    name: str
    lon: float
    lat: float
    label: str = ''


class GeocodingUtils:
    # Class-level so the one-request-per-second limit holds across all instances.
    _throttle_lock = threading.Lock()
    _last_request_at = 0.0

    def __init__(self):
        self.http_utils = HttpUtils()

    def geocode_city(self, city):
        city = city.strip()
        key = 'geocode:' + hashlib.sha1(city.lower().encode()).hexdigest()
        cached = cache.get(key)
        if cached is not None:
            logger.info('Redis geocode cache hit: %s', city)
            return Place(**cached)

        logger.info('Redis geocode cache miss: %s', city)

        results = self._search_city(city)
        if not results:
            raise LocationNotFound(city)
        hit = results[0]
        place = Place(name=city, lon=float(hit['lon']), lat=float(hit['lat']), label=hit.get('display_name', city))
        cache.set(key, asdict(place), GEOCODE_CACHE_SECONDS)
        return place

    def _search_city(self, city):
        cls = type(self)
        with cls._throttle_lock:
            wait = NOMINATIM_MIN_INTERVAL_SECONDS - (time.monotonic() - cls._last_request_at)
            if wait > 0:
                time.sleep(wait)
            try:
                return self.http_utils.get_json(
                    f'{settings.NOMINATIM_BASE_URL}/search',
                    {'q': city, 'format': 'jsonv2', 'limit': 1, 'featureType': 'city'},
                    service=GEOCODING_SERVICE,
                )
            finally:
                cls._last_request_at = time.monotonic()
