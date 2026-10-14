from django.conf import settings
from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    default_port = str(settings.DEV_SERVER_PORT)
