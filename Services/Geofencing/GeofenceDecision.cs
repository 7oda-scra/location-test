using SmartCodeAttendance.Services.Geolocation;

namespace SmartCodeAttendance.Services.Geofencing;

public sealed record GeofenceDecision(
    bool IsApproved,
    double DistanceMeters,
    string DistanceText,
    string StatusText,
    string Reason,
    BrowserLocation CurrentLocation,
    DateTimeOffset CheckedAt);
