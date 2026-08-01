using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
#if JELLYFIN_10_7
using MediaBrowser.Common.Plugins;
#else
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
#endif

namespace Jellyfin.Plugin.Iina;

public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
#if JELLYFIN_10_7
    public void RegisterServices(IServiceCollection serviceCollection)
#else
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
#endif
    {
        serviceCollection.AddSingleton<IStartupFilter, Web.ScriptInjectionStartupFilter>();
    }
}
