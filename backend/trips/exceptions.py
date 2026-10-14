class ExternalServiceError(Exception):
    pass


class LocationNotFound(Exception):
    def __init__(self, query):
        super().__init__(f'Could not find a location matching "{query}".')
        self.query = query


class RouteNotFound(Exception):
    pass


class TripPlanningError(Exception):
    pass
