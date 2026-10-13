import time

import requests
from django.conf import settings

from trips.constants import HTTP_MAX_RETRY_AFTER_SECONDS, HTTP_RETRY_DELAYS_SECONDS, HTTP_RETRY_STATUSES
from trips.exceptions import ExternalServiceError


class HttpUtils:
    _session = requests.Session()  # shared by every instance so connections are reused

    def get_json(self, url, params=None, *, service, ok_statuses=(200,)):
        """GET `url` and decode JSON, raising ExternalServiceError on any failure.

        Rate-limited (429) and briefly unavailable (503) responses are retried after
        HTTP_RETRY_DELAYS_SECONDS.
        """
        for delay in (*HTTP_RETRY_DELAYS_SECONDS, None):
            resp = self._get(url, params, service)
            if resp.status_code not in HTTP_RETRY_STATUSES or delay is None:
                break
            time.sleep(self._retry_delay(resp, delay))

        if resp.status_code not in ok_statuses:
            raise ExternalServiceError(f'{service} returned HTTP {resp.status_code}{self._reason(resp)}.')
        try:
            return resp.json()
        except ValueError as exc:
            raise ExternalServiceError(f'{service} returned a response that is not JSON.') from exc

    def _get(self, url, params, service):
        try:
            return self._session.get(
                url,
                params=params,
                headers={'User-Agent': settings.HTTP_USER_AGENT},
                timeout=settings.HTTP_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise ExternalServiceError(f'{service} is unreachable ({exc.__class__.__name__}).') from exc

    def _retry_delay(self, resp, default):
        """The server's Retry-After (in seconds) when it is short enough to wait for, else `default`."""
        retry_after = resp.headers.get('Retry-After', '')
        if retry_after.isdigit() and int(retry_after) <= HTTP_MAX_RETRY_AFTER_SECONDS:
            return int(retry_after)
        return default

    def _reason(self, resp):
        """The service's own explanation, e.g. Open-Meteo's "Daily API request limit exceeded"."""
        try:
            reason = resp.json().get('reason')
        except (ValueError, AttributeError):
            return ''
        return f": {reason.rstrip('.')}" if reason else ''
