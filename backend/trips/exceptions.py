class ExternalServiceError(Exception):
    """An upstream API (geocoding, routing or weather) failed or returned junk."""


class LocationNotFound(Exception):
    def __init__(self, query):
        super().__init__(f'Could not find a location matching "{query}".')
        self.query = query


class RouteNotFound(Exception):
    pass


class TripPlanningError(Exception):
    pass
