// KeyconVideoThumb (iOS) — capa dos vídeos do Locker, no APP e no TECLADO.
// ---------------------------------------------------------------------------
// Mesma API JS do VideoThumbModule.kt: thumbnail(url, key) → "file://..." ou
// null. Tira um quadro de ~1 s do vídeo (link da nuvem ou arquivo do aparelho),
// reduz para no máximo 480 px e guarda em JPEG no cache. O nome no cache vem de
// `key` (o caminho do arquivo na nuvem): o link do R2 muda quando é renovado.
//
// Este arquivo entra nos dois alvos (ios/project.yml: pasta Shared). No teclado,
// baixar o vídeo precisa do Acesso Total, como o resto do Locker.
#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

static NSString *const kThumbsDir = @"video-thumbs";
static const CGFloat kMaxSide = 480;

@interface KeyconVideoThumb : NSObject <RCTBridgeModule>
@end

@implementation KeyconVideoThumb

RCT_EXPORT_MODULE(KeyconVideoThumb)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/** Uma capa por vez: ler vídeo pela internet é pesado para o celular. */
+ (dispatch_queue_t)queue
{
  static dispatch_queue_t q;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    q = dispatch_queue_create("com.keycon.videothumb", DISPATCH_QUEUE_SERIAL);
  });
  return q;
}

RCT_EXPORT_METHOD(thumbnail:(NSString *)url
                  key:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async([KeyconVideoThumb queue], ^{
    @try {
      NSURL *dir = [[[NSFileManager defaultManager] URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask].firstObject
          URLByAppendingPathComponent:kThumbsDir isDirectory:YES];
      [[NSFileManager defaultManager] createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:nil error:nil];

      NSCharacterSet *bad = [[NSCharacterSet characterSetWithCharactersInString:
          @"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"] invertedSet];
      NSString *safe = [[key componentsSeparatedByCharactersInSet:bad] componentsJoinedByString:@"_"];
      if (safe.length == 0) safe = @"video";
      if (safe.length > 120) safe = [safe substringFromIndex:safe.length - 120];
      NSURL *file = [dir URLByAppendingPathComponent:[safe stringByAppendingString:@".jpg"]];

      if ([[NSFileManager defaultManager] fileExistsAtPath:file.path]) {
        resolve(file.absoluteString);
        return;
      }

      NSURL *source = [url hasPrefix:@"/"] ? [NSURL fileURLWithPath:url] : [NSURL URLWithString:url];
      if (!source) {
        resolve([NSNull null]);
        return;
      }
      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:source options:nil];
      AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:asset];
      generator.appliesPreferredTrackTransform = YES;
      generator.maximumSize = CGSizeMake(kMaxSide, kMaxSide);
      generator.requestedTimeToleranceBefore = kCMTimePositiveInfinity;
      generator.requestedTimeToleranceAfter = kCMTimePositiveInfinity;

      NSError *error = nil;
      CGImageRef image = [generator copyCGImageAtTime:CMTimeMakeWithSeconds(1, 600) actualTime:NULL error:&error];
      if (!image) image = [generator copyCGImageAtTime:kCMTimeZero actualTime:NULL error:&error];
      if (!image) {
        // Sem capa (sem internet, formato que o iOS não lê): o JS mostra o ícone
        resolve([NSNull null]);
        return;
      }
      NSData *jpeg = UIImageJPEGRepresentation([UIImage imageWithCGImage:image], 0.8);
      CGImageRelease(image);
      if (!jpeg || ![jpeg writeToURL:file atomically:YES]) {
        resolve([NSNull null]);
        return;
      }
      resolve(file.absoluteString);
    } @catch (NSException *e) {
      resolve([NSNull null]);
    }
  });
}

@end
