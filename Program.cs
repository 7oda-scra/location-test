using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor;
using MudBlazor.Services;
using SmartCodeAttendance;
using SmartCodeAttendance.Services.Authentication;
using SmartCodeAttendance.Services.Geofencing;
using SmartCodeAttendance.Services.Geolocation;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddAuthorizationCore();
builder.Services.AddScoped<SmartCodeAuthenticationStateProvider>();
builder.Services.AddScoped<AuthenticationStateProvider>(sp => sp.GetRequiredService<SmartCodeAuthenticationStateProvider>());
builder.Services.AddScoped<IAuthService>(sp => sp.GetRequiredService<SmartCodeAuthenticationStateProvider>());

builder.Services.AddScoped<BrowserGeolocationService>();
builder.Services.AddScoped<SmartCodeGeofenceService>();

builder.Services.AddMudServices(config =>
{
    config.SnackbarConfiguration.PositionClass = Defaults.Classes.Position.BottomRight;
    config.SnackbarConfiguration.PreventDuplicates = true;
    config.SnackbarConfiguration.NewestOnTop = true;
    config.SnackbarConfiguration.ShowCloseIcon = true;
    config.SnackbarConfiguration.VisibleStateDuration = 4000;
    config.SnackbarConfiguration.HideTransitionDuration = 180;
    config.SnackbarConfiguration.ShowTransitionDuration = 180;
});

await builder.Build().RunAsync();
