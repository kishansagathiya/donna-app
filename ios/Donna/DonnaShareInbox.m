#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DonnaShareInbox, NSObject)

RCT_EXTERN_METHOD(takePending:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
