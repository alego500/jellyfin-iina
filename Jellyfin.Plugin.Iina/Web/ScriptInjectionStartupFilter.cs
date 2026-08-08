using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iina.Web;

public sealed class ScriptInjectionStartupFilter : IStartupFilter
{
    private const string EndpointPath = "/JellyfinIina/client.js";
    private readonly ILogger<ScriptInjectionStartupFilter> _logger;

    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger)
    {
        _logger = logger;
    }

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(InjectClientScriptAsync);
            next(app);
        };
    }

    private async Task InjectClientScriptAsync(HttpContext context, Func<Task> next)
    {
        var requestPath = context.Request.Path.Value;
        if (!HttpMethods.IsGet(context.Request.Method)
            || !TryGetBasePath(requestPath, out var basePath)
            || Plugin.Instance?.Configuration.Enabled != true)
        {
            await next().ConfigureAwait(false);
            return;
        }

        RemoveHeadersThatCanProduceAnUnusableBody(context.Request.Headers);

        var originalBody = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await next().ConfigureAwait(false);
        }
        catch
        {
            context.Response.Body = originalBody;
            throw;
        }

        context.Response.Body = originalBody;
        buffer.Position = 0;

        if (context.Response.StatusCode != StatusCodes.Status200OK
            || context.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) != true)
        {
            await buffer.CopyToAsync(originalBody).ConfigureAwait(false);
            return;
        }

        string html;
        using (var reader = new StreamReader(buffer, Encoding.UTF8, true, leaveOpen: true))
        {
            html = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        var scriptUrl = $"{basePath}{EndpointPath}";
        if (!html.Contains(scriptUrl, StringComparison.OrdinalIgnoreCase))
        {
            var bodyEnd = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyEnd >= 0)
            {
                var replaceCardPlayButton = Plugin.Instance?.Configuration.ReplaceCardPlayButton != false
                    ? "true"
                    : "false";
                var tag = $"<script defer src=\"{scriptUrl}\" data-replace-card-play=\"{replaceCardPlayButton}\"></script>";
                html = string.Concat(html.AsSpan(0, bodyEnd), tag, "\n", html.AsSpan(bodyEnd));
                _logger.LogDebug("Injected the IINA Launcher client into Jellyfin Web.");
            }
        }

        var bytes = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength = bytes.Length;
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.Remove("Accept-Ranges");
        await originalBody.WriteAsync(bytes).ConfigureAwait(false);
    }

    internal static bool TryGetBasePath(string? path, out string basePath)
    {
        basePath = string.Empty;
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        var webIndex = path.LastIndexOf("/web/index.html", StringComparison.OrdinalIgnoreCase);
        if (webIndex >= 0 && webIndex + "/web/index.html".Length == path.Length)
        {
            basePath = path[..webIndex];
            return true;
        }

        var webSlash = path.LastIndexOf("/web/", StringComparison.OrdinalIgnoreCase);
        if (webSlash >= 0 && webSlash + "/web/".Length == path.Length)
        {
            basePath = path[..webSlash];
            return true;
        }

        var web = path.LastIndexOf("/web", StringComparison.OrdinalIgnoreCase);
        if (web >= 0 && web + "/web".Length == path.Length)
        {
            basePath = path[..web];
            return true;
        }

        return false;
    }

    private static void RemoveHeadersThatCanProduceAnUnusableBody(IHeaderDictionary headers)
    {
        headers.Remove("Accept-Encoding");
        headers.Remove("Range");
        headers.Remove("If-Range");
        headers.Remove("If-None-Match");
        headers.Remove("If-Modified-Since");
    }
}
