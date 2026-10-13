from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import Command as StaticfilesRunserverCommand


class Command(StaticfilesRunserverCommand):
    """`manage.py runserver` defaulting to this project's port (8010) instead of 8000.

    An explicit address/port argument still wins, e.g. `runserver 9000`.
    """

    default_port = str(settings.DEV_SERVER_PORT)
