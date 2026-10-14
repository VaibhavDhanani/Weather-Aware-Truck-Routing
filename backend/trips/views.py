from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from base.views import BaseViewSet
from trips.exceptions import ExternalServiceError, LocationNotFound, RouteNotFound, TripPlanningError
from trips.serializers import PlanTripRequestSerializer
from trips.utils.plan_trip_utils import PlanTripUtils


class TripViewSet(BaseViewSet):
    action_to_request_serializer_class = {'plan': PlanTripRequestSerializer}
    exception_status_codes = {
        LocationNotFound: status.HTTP_422_UNPROCESSABLE_ENTITY,
        RouteNotFound: status.HTTP_422_UNPROCESSABLE_ENTITY,
        TripPlanningError: status.HTTP_422_UNPROCESSABLE_ENTITY,
        ExternalServiceError: status.HTTP_502_BAD_GATEWAY,
    }

    @action(detail=False, methods=['post'])
    def plan(self, request):
        return Response(PlanTripUtils().plan_trip(**self.get_validated_data()))


class HealthViewSet(BaseViewSet):
    def list(self, request):
        return Response({'status': 'ok'})
