namespace SmartCodeAttendance.Services.Geolocation;

public sealed class GeolocationException : Exception
{
    public GeolocationException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
