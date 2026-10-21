import UIKit
import Capacitor

/// The app's bridge: Capacitor's own view controller plus the plugins that live in this app target
/// rather than in an npm package.
class RhythmeBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RhythmeHealthPlugin())
    }
}
