from django.conf import settings
from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    """`manage.py runserver` defaulting to this project's port (8010) instead of 8000.

    An explicit address/port argument still wins, e.g. `runserver 9000`.
    """

    default_port = str(settings.DEV_SERVER_PORT)
