#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

/**
 * App principal do KEYCON no iPhone (login, catálogo, configurações).
 * Abre o componente "CorretorApp" do index.js; o teclado (extensão) abre o
 * "CorretorKeyboard" do mesmo bundle, num processo separado.
 */
@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"CorretorApp";
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
