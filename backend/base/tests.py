from django.test import SimpleTestCase
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from base.views import BaseViewSet

factory = APIRequestFactory()


class Boom(Exception):
    pass


class NameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=5)


class EchoViewSet(BaseViewSet):
    action_to_request_serializer_class = {'echo': NameSerializer}
    exception_status_codes = {Boom: 409}

    @action(detail=False, methods=['post'])
    def echo(self, request):
        data = self.get_validated_data()
        if data['name'] == 'boom':
            raise Boom('it went boom')
        return Response(data)


view = EchoViewSet.as_view({'post': 'echo'})


class BaseViewSetTests(SimpleTestCase):
    def test_valid_body_uses_the_action_serializer(self):
        self.assertEqual(view(factory.post('/', {'name': 'ok'}, format='json')).data, {'name': 'ok'})

    def test_validation_error_has_detail_line_and_field_errors(self):
        resp = view(factory.post('/', {'name': 'too long'}, format='json'))
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['detail'], 'name: Ensure this field has no more than 5 characters.')
        self.assertIn('name', resp.data['errors'])

    def test_mapped_exception(self):
        resp = view(factory.post('/', {'name': 'boom'}, format='json'))
        self.assertEqual((resp.status_code, resp.data), (409, {'detail': 'it went boom'}))
