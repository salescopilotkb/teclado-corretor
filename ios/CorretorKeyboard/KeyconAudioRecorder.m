// KeyconAudioRecorder (iOS) — gravador dos atalhos de áudio, só no APP.
// ---------------------------------------------------------------------------
// Mesma API JS do AudioRecorderModule.kt: start(), stop() → { uri, name,
// mimeType, size, durationMs } e cancel(). Formato igual ao do Android: M4A
// (AAC, mono, 44,1 kHz, 96 kbps), até 5 minutos.
//
// Fica fora da extensão de teclado de propósito: a Apple proíbe microfone em
// teclados. No teclado do iPhone o JS não acha este módulo e esconde o "Gravar".
// O pedido do microfone (NSMicrophoneUsageDescription) sai na primeira gravação.
#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>

static NSString *const kRecordingsDir = @"recordings";
static const NSTimeInterval kMaxDuration = 5 * 60;

@interface KeyconAudioRecorder : NSObject <RCTBridgeModule>
@property (nonatomic, strong) AVAudioRecorder *recorder;
@property (nonatomic, strong) NSURL *output;
@property (nonatomic, strong) NSDate *startedAt;
@end

@implementation KeyconAudioRecorder

RCT_EXPORT_MODULE(KeyconAudioRecorder)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (void)releaseRecorderDeletingFile:(BOOL)deleteFile
{
  if (self.recorder.isRecording) {
    [self.recorder stop];
  }
  self.recorder = nil;
  if (deleteFile && self.output) {
    [[NSFileManager defaultManager] removeItemAtURL:self.output error:nil];
  }
  self.output = nil;
  [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];
}

- (void)beginRecordingResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject
{
  NSError *error = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  if (![session setCategory:AVAudioSessionCategoryPlayAndRecord mode:AVAudioSessionModeDefault options:AVAudioSessionCategoryOptionDefaultToSpeaker error:&error] ||
      ![session setActive:YES error:&error]) {
    reject(@"E_RECORD", [NSString stringWithFormat:@"Não foi possível usar o microfone: %@", error.localizedDescription], error);
    return;
  }

  NSURL *dir = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByAppendingPathComponent:kRecordingsDir isDirectory:YES];
  [[NSFileManager defaultManager] createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:nil error:nil];
  long long now = (long long)([[NSDate date] timeIntervalSince1970] * 1000);
  NSURL *file = [dir URLByAppendingPathComponent:[NSString stringWithFormat:@"audio-%lld.m4a", now]];

  NSDictionary *settings = @{
    AVFormatIDKey : @(kAudioFormatMPEG4AAC),
    AVNumberOfChannelsKey : @1,
    AVSampleRateKey : @44100.0,
    AVEncoderBitRateKey : @96000,
    AVEncoderAudioQualityKey : @(AVAudioQualityHigh),
  };
  AVAudioRecorder *recorder = [[AVAudioRecorder alloc] initWithURL:file settings:settings error:&error];
  if (!recorder || ![recorder recordForDuration:kMaxDuration]) {
    [self releaseRecorderDeletingFile:YES];
    reject(@"E_RECORD", [NSString stringWithFormat:@"Não foi possível usar o microfone: %@", error.localizedDescription ?: @"erro desconhecido"], error);
    return;
  }
  self.recorder = recorder;
  self.output = file;
  self.startedAt = [NSDate date];
  resolve(@YES);
}

RCT_EXPORT_METHOD(start:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self releaseRecorderDeletingFile:YES];
  AVAudioSession *session = [AVAudioSession sharedInstance];
  switch (session.recordPermission) {
    case AVAudioSessionRecordPermissionGranted:
      [self beginRecordingResolver:resolve rejecter:reject];
      break;
    case AVAudioSessionRecordPermissionDenied:
      reject(@"E_PERMISSION", @"O microfone está bloqueado para o KEYCON. Libere em Ajustes › KEYCON › Microfone.", nil);
      break;
    default: {
      __weak KeyconAudioRecorder *weakSelf = self;
      [session requestRecordPermission:^(BOOL granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (granted) {
            [weakSelf beginRecordingResolver:resolve rejecter:reject];
          } else {
            reject(@"E_PERMISSION", @"Sem permissão para usar o microfone.", nil);
          }
        });
      }];
    }
  }
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  AVAudioRecorder *recorder = self.recorder;
  NSURL *file = self.output;
  if (!recorder || !file) {
    reject(@"E_NOT_RECORDING", @"Nenhuma gravação em andamento.", nil);
    return;
  }
  // Passou dos 5 minutos: o gravador já parou sozinho
  NSTimeInterval duration = recorder.isRecording ? recorder.currentTime : MIN(-[self.startedAt timeIntervalSinceNow], kMaxDuration);
  [recorder stop];
  self.recorder = nil;
  self.output = nil;
  [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];

  NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:file.path error:nil];
  unsigned long long size = [attrs fileSize];
  if (duration < 1 || size == 0) {
    [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
    reject(@"E_TOO_SHORT", @"A gravação ficou curta demais. Segure por pelo menos 1 segundo.", nil);
    return;
  }
  resolve(@{
    @"uri" : file.absoluteString,
    @"name" : file.lastPathComponent,
    @"mimeType" : @"audio/mp4",
    @"size" : @(size),
    @"durationMs" : @(round(duration * 1000)),
  });
}

RCT_EXPORT_METHOD(cancel:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self releaseRecorderDeletingFile:YES];
  resolve(@YES);
}

@end
