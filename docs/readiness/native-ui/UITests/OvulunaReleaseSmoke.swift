import XCTest

final class OvulunaReleaseSmoke: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "app.vercel.ovuluna.dev")
    override func setUp() { super.setUp(); continueAfterFailure = false; XCUIDevice.shared.orientation = .portrait }
    override func tearDown() { XCUIDevice.shared.orientation = .portrait; super.tearDown() }
    func record(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a)
        print("OVULUNA_FINAL_STATE_\(name)\n\(app.debugDescription)")
    }
    func reach(_ element: XCUIElement, in region: XCUIElement? = nil, attempts: Int = 10) -> Bool {
        let surface = region ?? app.webViews.firstMatch
        for _ in 0..<attempts {
            if element.exists && element.isHittable { return true }
            surface.swipeUp()
        }
        return element.exists && element.isHittable
    }
    func testFinalEvidenceAndGuide() throws {
        app.terminate(); app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:20))
        if app.switches["Use dark theme"].exists { app.switches["Use dark theme"].tap() }
        let font=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Text size:")).firstMatch
        for _ in 0..<3 {
            if font.label.contains("Normal") { break }
            font.tap(); Thread.sleep(forTimeInterval:0.7)
        }
        // A rapid physical double tap should still change text without WebView zoom/pan.
        font.doubleTap(); Thread.sleep(forTimeInterval:0.7)
        XCTAssertTrue(font.label.contains("Extra large"),font.label)
        XCTAssertLessThanOrEqual(app.webViews.firstMatch.frame.width,app.frame.width+2)
        XCTAssertLessThanOrEqual(font.frame.width,46)
        XCTAssertGreaterThanOrEqual(font.frame.minX,0)
        record("01-rapid-Aplusplus")
        font.tap(); Thread.sleep(forTimeInterval:0.7)
        let luna=app.buttons["Open Luna offline guide"]
        XCTAssertTrue(luna.exists); luna.tap()
        XCTAssertTrue(app.buttons["Close Luna guide"].waitForExistence(timeout:5))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","prepared educational answers")).firstMatch.exists)
        app.buttons["Ovarian reserve"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","no validated ovarian-age conversion formula")).firstMatch.waitForExistence(timeout:5))
        record("02-offline-guide")
        app.buttons["Close Luna guide"].tap()
        app.links["Learn"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Knowledge Hub"].firstMatch.waitForExistence(timeout:8))
        let science=app.links["Ovarian science"].firstMatch; XCTAssertTrue(reach(science)); science.tap()
        let article=app.links["Understanding ovarian age"].firstMatch; XCTAssertTrue(reach(article)); article.tap()
        let trigger=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@","Read sources:")).firstMatch
        XCTAssertTrue(reach(trigger)); trigger.tap()
        let close=app.buttons["Close evidence"]; XCTAssertTrue(close.waitForExistence(timeout:5))
        let details=app.otherElements["Evidence details"].firstMatch
        XCTAssertGreaterThan(details.frame.height,200,"Actual integrated source body is readable")
        let source=app.links.matching(NSPredicate(format:"label CONTAINS %@","PubMed: 30913198")).firstMatch
        XCTAssertTrue(reach(source,in:details),"Can scroll to source in the actual app")
        let limits=app.staticTexts["Limitations"].firstMatch
        XCTAssertTrue(reach(limits,in:details),"Can reach limitations")
        record("03-evidence-sources-and-limits")
        close.tap()
        // Open again at app's largest text size, including landscape.
        let articleFont=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Text size:")).firstMatch
        articleFont.tap(); Thread.sleep(forTimeInterval:0.7); articleFont.tap(); Thread.sleep(forTimeInterval:0.7)
        XCTAssertTrue(reach(trigger)); trigger.tap(); XCTAssertTrue(close.waitForExistence(timeout:5))
        XCTAssertGreaterThan(details.frame.height,200)
        XCUIDevice.shared.orientation = .landscapeLeft; Thread.sleep(forTimeInterval:1)
        XCTAssertGreaterThan(details.frame.height,90)
        XCTAssertGreaterThan(app.frame.width, app.frame.height)
        XCTAssertGreaterThanOrEqual(details.frame.minX, app.frame.minX-1)
        XCTAssertLessThanOrEqual(details.frame.maxX, app.frame.maxX+1)
        XCTAssertLessThanOrEqual(details.frame.maxY, app.frame.maxY+1)
        XCTAssertTrue(close.isHittable)
        record("04-evidence-landscape-Aplusplus"); close.tap()
        XCUIDevice.shared.orientation = .portrait
        app.terminate(); app.launch(); XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:20))
        XCTAssertTrue(app.switches["Use light theme"].exists)
        let persistedFont=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Text size:")).firstMatch
        XCTAssertTrue(persistedFont.label.contains("Extra large"))
        record("05-preferences-cold-restart")
    }
}
