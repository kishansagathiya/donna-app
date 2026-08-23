import Foundation
import React

@objc(DonnaShareInbox)
final class DonnaShareInbox: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func takePending(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(DonnaShareStore.takePending())
  }
}
