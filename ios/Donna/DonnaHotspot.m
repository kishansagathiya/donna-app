#import "DonnaHotspot.h"
#import <NetworkExtension/NetworkExtension.h>
#import <Network/Network.h>

@implementation DonnaHotspot

RCT_EXPORT_MODULE();

static void applyHotspotConfigWithRefresh(
  NEHotspotConfigurationManager *mgr,
  NSString *ssid,
  NEHotspotConfiguration *config,
  BOOL refreshed,
  RCTPromiseResolveBlock resolve,
  RCTPromiseRejectBlock reject)
{
  [mgr applyConfiguration:config
        completionHandler:^(NSError * _Nullable error) {
    if (!error || error.code == NEHotspotConfigurationErrorAlreadyAssociated) {
      resolve(@(YES));
      return;
    }
    if (!refreshed) {
      [mgr removeConfigurationForSSID:ssid];
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{
        applyHotspotConfigWithRefresh(mgr, ssid, config, YES, resolve, reject);
      });
      return;
    }
    NSString *msg = [NSString stringWithFormat:@"%@ (NEHotspot code %ld)",
                     error.localizedDescription, (long)error.code];
    reject(@"HOTSPOT_JOIN_FAILED", msg, error);
  }];
}

RCT_REMAP_METHOD(requestLocalNetwork,
                 requestLocalNetworkWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  // Browsing a Bonjour service declared in NSBonjourServices triggers the
  // iOS local-network permission prompt (required to reach 192.168.4.1).
  nw_parameters_t params = nw_parameters_create();
  nw_parameters_set_include_peer_to_peer(params, true);

  nw_browser_t browser = nw_browser_create(
    nw_browse_descriptor_create_bonjour_service("_donna-sync._tcp", NULL),
    params
  );

  __block BOOL finished = NO;
  dispatch_queue_t queue = dispatch_get_main_queue();

  nw_browser_set_state_changed_handler(browser, ^(nw_browser_state_t state, nw_error_t error) {
    if (finished) return;
    if (state == nw_browser_state_ready || state == nw_browser_state_failed) {
      finished = YES;
      nw_browser_cancel(browser);
      resolve(@(YES));
    }
  });

  nw_browser_set_queue(browser, queue);
  nw_browser_start(browser);

  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3 * NSEC_PER_SEC)), queue, ^{
    if (finished) return;
    finished = YES;
    nw_browser_cancel(browser);
    resolve(@(YES));
  });
}

RCT_REMAP_METHOD(join,
                 joinWithSsid:(NSString *)ssid
                 psk:(NSString *)psk
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (ssid.length == 0 || psk.length == 0) {
    reject(@"EINVAL", @"SSID and password are required.", nil);
    return;
  }

  NEHotspotConfiguration *config =
    [[NEHotspotConfiguration alloc] initWithSSID:ssid
                                        passphrase:psk
                                            isWEP:NO];
  config.joinOnce = YES;

  NEHotspotConfigurationManager *mgr =
    [NEHotspotConfigurationManager sharedManager];

  // Apply without removing first — avoids repeated iOS "join network" prompts
  // when the profile is already installed from a prior sync.
  applyHotspotConfigWithRefresh(mgr, ssid, config, NO, resolve, reject);
}

RCT_REMAP_METHOD(leave,
                 leaveWithSsid:(NSString *)ssid
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (ssid.length == 0) {
    resolve(@(YES));
    return;
  }
  [[NEHotspotConfigurationManager sharedManager] removeConfigurationForSSID:ssid];
  resolve(@(YES));
}

@end
