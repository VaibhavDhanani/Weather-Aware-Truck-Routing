import logging
import time

import requests
from django.conf import settings

from trips.constants import (
    HTTP_MAX_RETRY_AFTER_SECONDS,
    HTTP_RETRY_DELAYS_SECONDS,
    HTTP_RETRY_STATUSES,
    HTTP_TIMEOUT_RETRIES,
)
from trips.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)


class HttpUtils:
    _session = requests.Session()

    def get_json(self, url, params=None, *, service, ok_statuses=(200,)):
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
        for attempt in range(HTTP_TIMEOUT_RETRIES + 1):
            try:
                return self._session.get(
                    url,
                    params=params,
                    headers={'User-Agent': settings.HTTP_USER_AGENT},
                    timeout=settings.HTTP_TIMEOUT_SECONDS,
                )
            except requests.Timeout as exc:
                if attempt == HTTP_TIMEOUT_RETRIES:
                    raise ExternalServiceError(f'{service} is unreachable ({exc.__class__.__name__}).') from exc
                logger.warning('%s timed out (%s), retrying', service, exc.__class__.__name__)
            except requests.RequestException as exc:
                raise ExternalServiceError(f'{service} is unreachable ({exc.__class__.__name__}).') from exc

    def _retry_delay(self, resp, default):
        retry_after = resp.headers.get('Retry-After', '')
        if retry_after.isdigit() and int(retry_after) <= HTTP_MAX_RETRY_AFTER_SECONDS:
            return int(retry_after)
        return default

    def _reason(self, resp):
        try:
            reason = resp.json().get('reason')
        except (ValueError, AttributeError):
            return ''
        return f": {reason.rstrip('.')}" if reason else ''
