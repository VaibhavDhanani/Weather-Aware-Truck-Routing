"""Django settings. Values that differ per environment come from environment
variables (locally from backend/.env.local); fixed app values live in trips/constants.py.

The API is stateless: no database, sessions or auth — only external services and Redis.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env.local')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-dev-only-change-me')
DEBUG = os.environ.get('DJANGO_DEBUG', 'true').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'trips',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {}

USE_TZ = True
TIME_ZONE = 'UTC'

# Default port for `manage.py runserver` (see trips/management/commands/runserver.py).
DEV_SERVER_PORT = int(os.environ.get('DEV_SERVER_PORT', '8010'))

# ---------------------------------------------------------------------------
# API

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'UNAUTHENTICATED_USER': None,
}

# Any localhost port (the Vite dev server) plus the deployed frontend(s).
CORS_ALLOWED_ORIGIN_REGEXES = [r'^http://(localhost|127\.0\.0\.1):\d+$']
CORS_ALLOWED_ORIGINS = [o for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o]

# ---------------------------------------------------------------------------
# Cache: Redis (plans for 60 s, forecasts for 30 min, city coordinates forever)

REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1')
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'KEY_PREFIX': 'wtr',
    }
}

# ---------------------------------------------------------------------------
# Logging: everything at INFO and above goes to stdout, which Render shows under Logs.

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'simple': {'format': '%(levelname)s %(name)s: %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'simple'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}

# ---------------------------------------------------------------------------
# External services (all free, no API keys required)

OSRM_BASE_URL = os.environ.get('OSRM_BASE_URL', 'https://router.project-osrm.org')
NOMINATIM_BASE_URL = os.environ.get('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org')
OPEN_METEO_BASE_URL = os.environ.get('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com')
HTTP_USER_AGENT = os.environ.get('HTTP_USER_AGENT', 'weather-aware-truck-routing/0.1 (dev)')
HTTP_TIMEOUT_SECONDS = float(os.environ.get('HTTP_TIMEOUT_SECONDS', '30'))
