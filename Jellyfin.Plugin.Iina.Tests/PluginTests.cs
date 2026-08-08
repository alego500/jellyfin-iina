using Jellyfin.Plugin.Iina.Configuration;
using Jellyfin.Plugin.Iina.Controllers;
using Jellyfin.Plugin.Iina.Web;
using Xunit;

namespace Jellyfin.Plugin.Iina.Tests;

public sealed class PluginTests
{
    [Theory]
    [InlineData("/web", "")]
    [InlineData("/web/", "")]
    [InlineData("/web/index.html", "")]
    [InlineData("/jellyfin/web", "/jellyfin")]
    [InlineData("/jellyfin/web/", "/jellyfin")]
    [InlineData("/jellyfin/web/index.html", "/jellyfin")]
    public void WebIndexRequestsPreserveBasePath(string path, string expectedBasePath)
    {
        var matched = ScriptInjectionStartupFilter.TryGetBasePath(path, out var basePath);

        Assert.True(matched);
        Assert.Equal(expectedBasePath, basePath);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("/")]
    [InlineData("/web/assets/client.js")]
    [InlineData("/not-web")]
    public void NonIndexRequestsAreIgnored(string? path)
    {
        Assert.False(ScriptInjectionStartupFilter.TryGetBasePath(path, out _));
    }

    [Fact]
    public void PluginIsEnabledByDefault()
    {
        var configuration = new PluginConfiguration();

        Assert.True(configuration.Enabled);
        Assert.True(configuration.ReplaceCardPlayButton);
    }

    [Fact]
    public void EmbeddedClientScriptCanBeServed()
    {
        var result = new ClientController().GetClientScript();

        Assert.Contains("Open in IINA", result.Content, StringComparison.Ordinal);
        Assert.Contains("jellyfinOpenInIinaMenuItem", result.Content, StringComparison.Ordinal);
        Assert.Contains("replaceCardPlay", result.Content, StringComparison.Ordinal);
        Assert.Contains("jellyfin-iina-config-changed", result.Content, StringComparison.Ordinal);
        Assert.Contains("btnReplay", result.Content, StringComparison.Ordinal);
        Assert.Contains("NonPlayableItemError", result.Content, StringComparison.Ordinal);
        Assert.Contains("resume", result.Content, StringComparison.Ordinal);
        Assert.Contains("iina://open", result.Content, StringComparison.Ordinal);
        Assert.Equal("application/javascript; charset=utf-8", result.ContentType);
    }
}
