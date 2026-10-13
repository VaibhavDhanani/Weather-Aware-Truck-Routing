from rest_framework.routers import SimpleRouter

from trips.views import HealthViewSet, TripViewSet

router = SimpleRouter()
router.register('trips', TripViewSet, basename='trips')
router.register('health', HealthViewSet, basename='health')

urlpatterns = router.urls
