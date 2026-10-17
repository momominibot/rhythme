import XCTest
final class OvulunaSettingsSmoke: XCTestCase {
    let app = XCUIApplication(bundleIdentifier:"app.vercel.ovuluna.dev")
    override func setUp(){super.setUp();continueAfterFailure=false;XCUIDevice.shared.orientation = .portrait}
    func reach(_ el:XCUIElement,in region:XCUIElement?=nil)->Bool {
        let surface=region ?? app.webViews.firstMatch
        for _ in 0..<12 { if el.exists && el.isHittable {return true};surface.swipeUp() }
        return el.exists && el.isHittable
    }
    func record(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a);print("OVULUNA_SETTINGS_\(name)\n\(app.debugDescription)")}
    func settings() {
        app.buttons["All screens"].tap()
        let link=app.links.matching(NSPredicate(format:"label ENDSWITH %@","Settings")).firstMatch
        XCTAssertTrue(reach(link));link.tap()
        XCTAssertTrue(app.links.matching(NSPredicate(format:"label BEGINSWITH %@","Delete my data")).firstMatch.waitForExistence(timeout:5))
    }
    func testSettingsDeletionReviewAndAccountStatus() throws {
        app.terminate();app.launch();XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:20))
        let font=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Text size:")).firstMatch
        for _ in 0..<3 {if font.label.contains("Normal"){break};font.tap();Thread.sleep(forTimeInterval:0.7)}
        settings()
        let data=app.links.matching(NSPredicate(format:"label BEGINSWITH %@","Delete my data")).firstMatch;XCTAssertTrue(reach(data));data.tap()
        XCTAssertTrue(app.staticTexts["Delete or export local data"].firstMatch.waitForExistence(timeout:5))
        let select=app.buttons["Select all listed local items"];XCTAssertTrue(reach(select));select.tap()
        let review=app.buttons["Review selected deletion"];XCTAssertTrue(reach(review));review.tap()
        let cancel=app.buttons["Cancel"];XCTAssertTrue(cancel.waitForExistence(timeout:5))
        XCTAssertFalse(app.buttons["Delete selected items"].isEnabled)
        record("01-review-requires-confirmation")
        cancel.tap();XCTAssertTrue(review.waitForExistence(timeout:5));XCTAssertTrue(review.isEnabled)
        settings()
        let account=app.links.matching(NSPredicate(format:"label BEGINSWITH %@","Delete my account")).firstMatch;XCTAssertTrue(reach(account));account.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","No connected account in this build.")).firstMatch.waitForExistence(timeout:5))
        record("02-account-not-connected")
        // This native check deliberately cancels. Synthetic deletion is covered in browser regressions.
    }
}
