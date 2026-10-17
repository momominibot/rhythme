# Shared shell and accessibility pass

Local implementation review: 11 September 2026. Baseline commit: `b866852`. This pass preserves Doubao’s palette, watercolor art and fixed navigation. It does not certify the entire app, WCAG conformance, native Dynamic Type, or iOS submission readiness.

## What changed

| Area | Verified problem | Bounded repair |
| --- | --- | --- |
| Top controls | At320px, notification/calendar links shrank to about23.7×38px | All four top controls retain44×44px targets. Logo spacing adapts at narrow widths; the top wraps below300px. |
| Fixed bars | Content reserved hardcoded68/92px while bars had separate safe-area padding | Shared spacing uses measured top/nav border boxes plus content clearance. ResizeObserver, font readiness and viewport resize remeasure geometry. |
| Bottom navigation | `.nav` was centered at430px; `.bottom-nav` spanned the viewport | Both variants align with the same430px app column and have minimum44px targets. |
| Text | Root rem scale plus content zoom multiplied inherited/rem text twice | Legacy px layouts keep one content zoom; inherited body text uses the captured browser base. Rem layouts use one root scale and no content zoom. |
| Motion | Disabling CSS animations left chart paths at their initial hidden dash offset; JS counts/petals still animated | Final chart strokes and counter text are visible immediately in reduced motion. Decorative petals are not created. Generic paths also remain visible when a legacy page omits anim.css. |
| Component charts | Generic SVG animation rewrote component-owned ring paths | `#mysticalRingSvg`, `#hormone-plot`, `#countdownRing`, and `[data-no-auto-animation]` opt out of both generic SVG passes. Their controllers retain their own chart/progress state. |

Changed files: `theme.css`, `darkmode.css`, `darkmode.js`, `anim.css`, `anim.js`, the specifically coordinated animation blocks in `appnav.js`, and `scripts/check-shell.cjs`. No route behavior or clinical copy was changed by this pass.

## Layout and typography contract

- `.app` is the shared430px maximum column. `.top`, `.nav` and `.bottom-nav` remain fixed and outside the content scale.
- `.app > .scroll` and `.app > .content` receive the active content behavior. `--shell-top-size` and `--shell-bottom-size` hold actual rendered bar heights, including safe-area padding. Content starts8px after the top bar; the app reserves an additional16px below its bottom bar.
- `--shell-safe-top/bottom/left/right` default to the browser’s `env(safe-area-inset-*)` values. The coordinator is updating static viewport tags to `viewport-fit=cover`; this script does not dynamically rewrite viewport settings.
- A/A+/A++ retain100/115/130%. The initial root font size is captured before the preference is applied. The fixed bars do not grow with this app control.
- Existing px layouts, including Learn articles and ovarian entry, retain legacy content zoom. New rem-based pages add `text-scaled-page` to the body; Home and Bio-Age also have compatibility aliases. These pages must use rem/em typography for text that should grow. Do not mix new rem text into an unmigrated legacy content shell: migrate the whole page’s typography and then opt in.
- Portaled evidence sheets already use rem and sit outside the zoomed content, so they receive the root scale once.
- No pinch/browser zoom restriction is introduced. The current A++ setting is130%, **not** a substitute for testing200% text resizing or native accessibility text categories.

## Verification

`node scripts/check-shell.cjs` runs actual Chromium layout and interaction checks in a fresh browser profile. It requires an available Playwright installation; set `OVULUNA_PLAYWRIGHT_MODULE` to an existing module path when it is outside the project. `OVULUNA_TEST_URL` must be a localhost preview of the current checkout; default is `http://localhost:4197`.

The isolated4197 preview reads the checkout directly. The coordinator’s4194 preview reads `/private/tmp/ovuluna-doubao-preview`, so that mirror must be refreshed before using it to review source changes. User browser profiles and existing local health records were not used by this suite.

Coverage:

- 21 real layouts: Home, Learn hub, TCM hub, Bio-Age, ovarian entry, Learn biomarkers and Profile at320/390/768px in dark mode with A++.
- Both content/nav variants,44px targets, fixed-bar alignment, horizontal page overflow and last-content clearance.
- Effective text geometry at100/115/130% in legacy inherited text, px layouts and rem layouts; saved preference persistence.
- Simulated44px top/34px bottom CSS insets and responsive header wrapping. This caught and fixed the need to observe the **border box**: changing padding alone does not change the default observed content box.
- Theme state, keyboard focus indication, reduced-motion chart/counter final states, no decorative Web Animations, and preservation of component-owned chart/progress offsets, including the actual PPG `#countdownRing` markup with a simulated offset. This is a selector/DOM regression, not a camera or acquisition-timing test.

The suite blocks external network requests and uses local/fallback fonts. A separate isolated agent-browser screenshot at320px verified the real loaded-font header. Test output includes the measured geometry and states; source syntax and whitespace checks also apply.

## Primary guidance and limits

- WebKit explains the `viewport-fit=cover`/safe-area padding relationship and preserving ordinary spacing alongside insets. The simulated inset checks exercise the app’s CSS contract; physical Safari portrait/landscape, browser chrome, keyboard and standalone/WKWebView behavior remain unverified. [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- ResizeObserver distinguishes content-box and border-box observation. The latter is required here to detect padding changes. [W3C Resize Observer specification](https://drafts.csswg.org/resize-observer/#dom-resizeobserver-observe)
- 44×44CSSpx is the selected shell target; WCAG2.5.5 is an enhanced **AAA** target-size criterion, not an assertion that the whole app passes AA/AAA. [W3C Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- WCAG reflow concerns320CSSpx vertical content, with exceptions for inherently two-dimensional content. Text resize addresses200% without losing content/functionality. This representative suite does not establish either criterion across every app page. [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- Nonessential interaction motion should be suppressible; these guards honor `prefers-reduced-motion` while preserving final information. Dedicated breathing/measurement controllers still need their own interaction/device review. [W3C Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- Native Dynamic Type includes system text sizes and layouts that adapt to those sizes. Ovuluna’s web-only three-size control is not a native Dynamic Type bridge. WKWebView font behavior needs deliberate implementation and testing. [Apple: Get started with Dynamic Type](https://developer.apple.com/videos/play/wwdc2024/10074/), [WebKit WKWebView text-size issue and implementation discussion](https://bugs.webkit.org/show_bug.cgi?id=187013)

Remaining work: independently review the completed Home interactions, every other route and dialog, full font/locale combinations,200% text and browser zoom, VoiceOver, actual iPhone safe areas/keyboard/rotation, touch gestures, and native accessibility categories. Page-specific fixed grids/tables, custom canvas text and floating Luna/tooltips may need separate reflow/focus fixes. The shared generic animator remains a legacy heuristic; future interactive charts must opt out explicitly. No evidence from this pass validates a clinical score or App Store readiness.
