// TranslatorModule.m — expõe o tradutor Swift (ML Kit) ao React Native como KeyconTranslator.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(KeyconTranslator, NSObject)

RCT_EXTERN_METHOD(isReady:(NSString *)source
                  target:(NSString *)target
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(translate:(NSString *)text
                  source:(NSString *)source
                  target:(NSString *)target
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
