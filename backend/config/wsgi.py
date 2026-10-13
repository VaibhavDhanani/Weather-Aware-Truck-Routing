"""WSGI entry point for production servers (`gunicorn config.wsgi`)."""

import logging
import os
from urllib.parse import urlsplit

from django.conf import settings
from django.core.cache import cache
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# Log once per worker whether Redis is reachable, so a bad REDIS_URL shows up at deploy time.
logger = logging.getLogger(__name__)
redis_host = urlsplit(settings.REDIS_URL).hostname  # host only: the URL can contain a password
try:
    cache.set('startup-check', 'ok', 10)
    logger.info('Redis connected (%s)', redis_host)
except Exception as exc:
    logger.error('Redis unavailable (%s): %s', redis_host, exc)
