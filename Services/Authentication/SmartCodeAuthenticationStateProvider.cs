using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace SmartCodeAttendance.Services.Authentication;

public sealed class SmartCodeAuthenticationStateProvider : AuthenticationStateProvider, IAuthService
{
    private const string ValidUsername = "Mahmoud";
    private const string ValidPassword = "1";

    private static readonly ClaimsPrincipal Anonymous = new(new ClaimsIdentity());

    private ClaimsPrincipal _currentUser = Anonymous;

    public override Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        return Task.FromResult(new AuthenticationState(_currentUser));
    }

    public Task<bool> LoginAsync(string username, string password)
    {
        var isValid = string.Equals(username?.Trim(), ValidUsername, StringComparison.Ordinal)
            && string.Equals(password, ValidPassword, StringComparison.Ordinal);

        if (!isValid)
        {
            return Task.FromResult(false);
        }

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.Name, ValidUsername),
                new Claim(ClaimTypes.Role, "SmartCodeStaff"),
                new Claim("company", "Smart Code")
            ],
            authenticationType: "SmartCodeSimulation");

        _currentUser = new ClaimsPrincipal(identity);
        NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());

        return Task.FromResult(true);
    }

    public Task LogoutAsync()
    {
        _currentUser = Anonymous;
        NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());

        return Task.CompletedTask;
    }

    public Task<bool> IsAuthenticatedAsync()
    {
        return Task.FromResult(_currentUser.Identity?.IsAuthenticated == true);
    }

    public Task<string?> GetUserNameAsync()
    {
        return Task.FromResult(_currentUser.Identity?.Name);
    }
}
