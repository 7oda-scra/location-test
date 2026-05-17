namespace SmartCodeAttendance.Services.Authentication;

public interface IAuthService
{
    Task<bool> LoginAsync(string username, string password);

    Task LogoutAsync();

    Task<bool> IsAuthenticatedAsync();

    Task<string?> GetUserNameAsync();
}
