using SmartCodeAttendance.Services.Geolocation;

namespace SmartCodeAttendance.Services.Geofencing;

public sealed class SmartCodeGeofenceService
{
    public const double TargetLatitude = 30.786908;
    public const double TargetLongitude = 31.001009;
    public const double RadiusMeters = 50;

    private const double EarthRadiusMeters = 6_371_000;

    public GeofenceDecision Evaluate(BrowserLocation currentLocation)
    {
        var distanceMeters = CalculateDistanceMeters(
            currentLocation.Latitude,
            currentLocation.Longitude,
            TargetLatitude,
            TargetLongitude);

        var isApproved = distanceMeters <= RadiusMeters;
        var distanceText = FormatDistance(distanceMeters);
        var statusText = isApproved ? "Success" : "Denied";
        var reason = isApproved
            ? "Approved: You are within the authorized Smart Code boundary."
            : $"Disapproved: You are {FormatDistance(distanceMeters - RadiusMeters)} outside the designated workspace.";

        return new GeofenceDecision(
            isApproved,
            distanceMeters,
            distanceText,
            statusText,
            reason,
            currentLocation,
            DateTimeOffset.UtcNow);
    }

    public static string FormatDistance(double meters)
    {
        if (meters < 1000)
        {
            return $"{Math.Round(meters):0} m";
        }

        return $"{meters / 1000:0.0} km";
    }

    public static double CalculateDistanceMeters(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        var lat1Radians = DegreesToRadians(latitude1);
        var lat2Radians = DegreesToRadians(latitude2);
        var deltaLatitude = DegreesToRadians(latitude2 - latitude1);
        var deltaLongitude = DegreesToRadians(longitude2 - longitude1);

        // Haversine computes the great-circle distance between two points on a sphere.
        // It is stable for short distances, which makes it a good fit for a 50 meter geofence.
        var haversine = Math.Pow(Math.Sin(deltaLatitude / 2), 2)
            + Math.Cos(lat1Radians) * Math.Cos(lat2Radians) * Math.Pow(Math.Sin(deltaLongitude / 2), 2);

        var angularDistance = 2 * Math.Atan2(Math.Sqrt(haversine), Math.Sqrt(1 - haversine));

        return EarthRadiusMeters * angularDistance;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180;
    }
}
