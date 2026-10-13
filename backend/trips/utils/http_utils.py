import requests
from django.conf import settings

from trips.exceptions import ExternalServiceError


class HttpUtils:
    _session = requests.Session()  # shared by every instance so connections are reused

    def get_json(self, url, params=None, *, service, ok_statuses=(200,)):
        """GET `url` and decode JSON, raising ExternalServiceError on any failure."""
        try:
            resp = self._session.get(
                url,
                params=params,
                headers={'User-Agent': settings.HTTP_USER_AGENT},
                timeout=settings.HTTP_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise ExternalServiceError(f'{service} is unreachable ({exc.__class__.__name__}).') from exc
        if resp.status_code not in ok_statuses:
            raise ExternalServiceError(f'{service} returned HTTP {resp.status_code}.')
        try:
            return resp.json()
        except ValueError as exc:
            raise ExternalServiceError(f'{service} returned a response that is not JSON.') from exc
