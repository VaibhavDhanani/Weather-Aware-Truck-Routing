from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet


def first_error_message(errors):
    field, messages = next(iter(errors.items()))
    message = messages[0] if isinstance(messages, list) else messages
    return str(message) if field == 'non_field_errors' else f'{field}: {message}'


class BaseViewSet(ViewSet):
    action_to_request_serializer_class = {}
    exception_status_codes = {}

    def get_validated_data(self):
        serializer = self.action_to_request_serializer_class[self.action](data=self.request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def handle_exception(self, exc):
        for exc_class, status_code in self.exception_status_codes.items():
            if isinstance(exc, exc_class):
                return Response({'detail': str(exc)}, status=status_code)

        response = super().handle_exception(exc)
        if isinstance(exc, serializers.ValidationError) and isinstance(response.data, dict):
            response.data = {'detail': first_error_message(response.data), 'errors': response.data}
        return response
