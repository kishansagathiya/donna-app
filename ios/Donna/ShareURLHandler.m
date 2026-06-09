#import "ShareURLHandler.h"
#import <RNShareMenu/ShareMenuManager.h>

BOOL DonnaHandleOpenURL(
  UIApplication *app,
  NSURL *url,
  NSDictionary<UIApplicationOpenURLOptionsKey, id> *options
) {
  return [ShareMenuManager application:app openURL:url options:options];
}
