using Microsoft.JSInterop;

namespace SmartCodeAttendance.Services.Geolocation;

public sealed class BrowserGeolocationService(IJSRuntime jsRuntime)
{
    public async Task<BrowserLocation> GetCurrentPositionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var position = await jsRuntime.InvokeAsync<BrowserLocationDto>(
                "smartCodeGeo.getCurrentPosition",
                cancellationToken);

            return new BrowserLocation(
                position.Latitude,
                position.Longitude,
                position.Accuracy,
                DateTimeOffset.FromUnixTimeMilliseconds(position.Timestamp));
        }
        catch (JSException ex)
        {
            throw new GeolocationException(ex.Message, ex);
        }
    }

    private sealed class BrowserLocationDto
    {
        public double Latitude { get; set; }

        public double Longitude { get; set; }

        public double? Accuracy { get; set; }

        public long Timestamp { get; set; }
    }
}
