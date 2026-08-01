using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Iina.Controllers;

[ApiController]
[Route("JellyfinIina")]
public sealed class ClientController : ControllerBase
{
    private const string ResourceName = "Jellyfin.Plugin.Iina.Web.client.js";
    private static readonly Lazy<string> ClientScript = new(LoadClientScript);

    [AllowAnonymous]
    [HttpGet("client.js")]
    [Produces("application/javascript")]
    [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
    public ContentResult GetClientScript()
    {
        return Content(ClientScript.Value, "application/javascript; charset=utf-8", Encoding.UTF8);
    }

    private static string LoadClientScript()
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} was not found.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
