from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from trips.constants import (
    CITY_NAME_ERROR,
    CITY_NAME_PATTERN,
    DEPARTURE_GRACE_HOURS,
    INTERVAL_MILES_CHOICES,
    LOCATION_MAX_LENGTH,
    MAX_DEPARTURE_DAYS_AHEAD,
    MAX_GROSS_WEIGHT_LBS,
)


class CityNameField(serializers.RegexField):
    def __init__(self, **kwargs):
        super().__init__(
            CITY_NAME_PATTERN,
            min_length=2,
            max_length=LOCATION_MAX_LENGTH,
            error_messages={'invalid': CITY_NAME_ERROR},
            **kwargs,
        )


class PlanTripRequestSerializer(serializers.Serializer):
    origin = CityNameField()
    destination = CityNameField()
    departure = serializers.DateTimeField()
    loadWeightLbs = serializers.FloatField(min_value=0, max_value=MAX_GROSS_WEIGHT_LBS)
    intervalMiles = serializers.ChoiceField(choices=INTERVAL_MILES_CHOICES)

    def validate_departure(self, value):
        now = timezone.now()
        if value < now - timedelta(hours=DEPARTURE_GRACE_HOURS):
            raise serializers.ValidationError('Departure time is in the past.')
        if value > now + timedelta(days=MAX_DEPARTURE_DAYS_AHEAD):
            raise serializers.ValidationError(
                f'Departure must be within {MAX_DEPARTURE_DAYS_AHEAD} days; forecasts do not reach further.'
            )
        return value

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        return {
            'origin': values['origin'],
            'destination': values['destination'],
            'departure': values['departure'],
            'load_weight_lbs': values['loadWeightLbs'],
            'interval_miles': values['intervalMiles'],
        }
