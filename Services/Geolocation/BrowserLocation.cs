namespace SmartCodeAttendance.Services.Geolocation;

public sealed record BrowserLocation(
    double Latitude,
    double Longitude,
    double? AccuracyMeters,
    DateTimeOffset Timestamp);
