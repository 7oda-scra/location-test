using SmartCodeAttendance.Services.Geolocation;

namespace SmartCodeAttendance.Models;

public sealed record AttendanceLogEntry(
    string EmployeeName,
    BrowserLocation CurrentLocation,
    double DistanceMeters,
    bool IsApproved,
    DateTimeOffset SignedAt);
