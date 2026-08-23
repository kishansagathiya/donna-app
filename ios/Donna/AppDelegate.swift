import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Donna",
      in: window,
      launchOptions: launchOptions
    )

    if let url = launchOptions?[.url] as? URL {
      DonnaShareStore.ingest(url: url)
    }
    consumePendingShareIfNeeded(application)
    return true
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    consumePendingShareIfNeeded(application)
  }

  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    DonnaShareStore.ingest(url: url)
    return DonnaHandleOpenURL(app, url, options)
  }

  /// Pick up App Group inbox items if the share extension couldn't open a payload URL.
  private func consumePendingShareIfNeeded(_ application: UIApplication) {
    guard
      let defaults = UserDefaults(suiteName: "group.com.kishansagathiya.donna"),
      defaults.object(forKey: "ShareMenuUserDefaults") != nil,
      let url = URL(string: "donna://share")
    else {
      return
    }
    _ = DonnaHandleOpenURL(application, url, [:])
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
