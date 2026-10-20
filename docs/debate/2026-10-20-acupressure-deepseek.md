# Acupressure review with DeepSeek (20 October 2026)

Model: deepseek-v4-pro-ga-260813 on Volcengine Ark, as a TCM practitioner and educator. Independent check: doubao-seed-2-1-pro-260915. Primary sources: the WHO 2008 standard as quoted in published papers (the WHO PDF refuses automated fetches), and Liang et al. 2024, international TCM clinical guidelines for dysmenorrhea (PMC11589548).

## Round 1, all 13 points (verbatim JSON)

```json
{"points":[
 {"id":"sp6","verdict":"correct","issues":[]},
 {"id":"cv4","verdict":"correct","issues":[]},
 {"id":"st36","verdict":"minor","issues":[{"field":"location","problem":"The stated WHO location omits the standard defining distance from the tibia (one finger-width lateral to the anterior border/crest of the tibia).","fix":"Front of leg, 3 B-cun below ST35, one finger-width lateral to the anterior border of the tibia, on the ST35 to ST41 line over tibialis anterior."}]},
 {"id":"lr3","verdict":"minor","issues":[{"field":"caution","problem":"No pregnancy caution is listed, but LR3 is traditionally considered a strong qi-moving point and is often included in conservative pregnancy cautions.","fix":"Pregnant or might be? Check with your maternity team before using this point. Traditional caution is not proof that touching it causes harm."}]},
 {"id":"li4","verdict":"correct","issues":[]},
 {"id":"pc6","verdict":"correct","issues":[]},
 {"id":"cv6","verdict":"correct","issues":[]},
 {"id":"cv3","verdict":"correct","issues":[]},
 {"id":"st29","verdict":"correct","issues":[]},
 {"id":"sp10","verdict":"correct","issues":[]},
 {"id":"ki3","verdict":"correct","issues":[]},
 {"id":"bl23","verdict":"correct","issues":[]},
 {"id":"gv4","verdict":"correct","issues":[]}
],
"general":[{"problem":"The basic instruction to press gently for one to two minutes and breathe slowly is sound, but the safety screening is too thin for a consumer app.","fix":"Add: Do not press on broken, red, hot, swollen or bruised skin; avoid varicose veins, lumps, recent injury, or areas with a possible blood clot. If you take blood thinners or bruise/bleed easily, use only very light pressure. Stop immediately for pain, numbness, tingling, dizziness, or worsening symptoms. Seek medical care for severe, sudden, or unexplained symptoms. This is an educational atlas, not a treatment plan."}],
"missing_points":[{"code":"SP8","why":"Diji, the Spleen xi-cleft point, is a traditional primary point for acute dysmenorrhea and period cramps; its absence weakens the menstrual self-care set."}],
"remove_points":[]}
```

## Independent check (Doubao, verbatim JSON)

```json
{"answers": [
    {"q": 1, "answer": "WHO 2008 location: On the medial aspect of the lower leg, 3 cun inferior to SP9 (Yinlingquan), on the line connecting the medial condyle of the tibia and the medial malleolus, posterior to the medial border of the tibia. Traditional category: Xi-cleft (cleft) point of the Foot Taiyin Spleen Meridian. Main traditional indication: It is primarily indicated for gynecological conditions including irregular menstruation, dysmenorrhea, and abnormal uterine bleeding (metrorrhagia/metrostaxis), as well as abdominal pain, diarrhea, and edema.", "confidence": "high"},
    {"q": 2, "answer": "some sources; SP8 has a strong traditional action of moving blood and regulating uterine function and menstruation, so some sources caution or prohibit its use during pregnancy due to risk of inducing uterine contraction, miscarriage or preterm labor, but this is not a universal traditional prohibition.", "confidence": "high"},
    {"q": 3, "answer": "LR3 (Taichong) is not included on the standard classical list of acupuncture points forbidden during pregnancy. Pregnancy caution for LR3 is a conservative modern addition, derived from its strong function of moving and regulating qi and blood, rather than a classical prohibition.", "confidence": "high"},
    {"q": 4, "answer": "Yes, this wording is included in the WHO 2008 standard location text for ST36. The full WHO 2008 location adds that ST36 is 3 cun inferior to ST35 (Dubi), on the Stomach meridian line connecting ST35 and ST41 (Jiexi) on the anterior lower leg.", "confidence": "high"},
    {"q": 5, "answer": "Strong stimulation (including firm deep pressure and strong/excessive moxibustion) of BL23 and GV4 is traditionally cautioned, as these lumbosacral points fall under the traditional broad caution for lumbosacral points during pregnancy over risk of disrupting pregnancy. However, gentle pressure or mild moxibustion has traditionally been permitted for these points when clinically indicated (e.g. kidney deficiency-related pregnancy back pain or threatened miscarriage) by a qualified practitioner, so there is no absolute prohibition.", "confidence": "high"}
]}
```

## Round 2, the changes (verbatim JSON)

```json
{"items":[{"n":1,"verdict":"ok","fix":null,"why":"The plain-language location matches WHO SP8: 3 B-cun below SP9 and just posterior to the tibial border."},{"n":2,"verdict":"ok","fix":null,"why":"The four-finger measurement from SP9 approximates 3 B-cun; the landmarking is safe and reasonably accurate for self-acupressure."},{"n":3,"verdict":"fix","fix":"Use: Period cramps, especially on the first day. Research: Traditional acupuncture uses this point for period pain; self-acupressure evidence at this single point is limited.","why":"The original statement that self-pressure has not been studied is too absolute and may be inaccurate; a limited-evidence statement is safer."},{"n":4,"verdict":"ok","fix":null,"why":"Both points have traditional pregnancy cautions, and the wording is precautionary without overstating harm."},{"n":5,"verdict":"ok","fix":null,"why":"Lower-back points warrant a light-pressure and maternity-team check during pregnancy; the wording is safe."},{"n":6,"verdict":"ok","fix":null,"why":"The list covers key acupressure safety red flags, bleeding precautions, and concerning period-pain symptoms."},{"n":7,"verdict":"ok","fix":null,"why":"The ST35-to-ST41 line-and-distance form is acceptable for WHO ST36, and the finger-width instructions match the 3-cun lateral location."}]}
```

## What was done

- Taken: SP8 added (location, four-finger finding, first-day cramps, limited-evidence line citing E27, which names SP8 for primary dysmenorrhea with needles only), placed on the inner-leg illustration at 52, 38.5 by the 13 B-cun SP9-to-malleolus proportion; pregnancy cautions on SP8 and LR3 (conservative; neither model calls them classical prohibitions); light-pressure caution for BL23 and GV4; a before-you-press safety list.
- Not taken: adding the one-finger-breadth phrase to the ST36 WHO line. Published quotations of the WHO 2008 text give the line-and-distance form; the phrase is from other textbooks, and the app's finding instruction already says it. DeepSeek accepted this in round 2.
- Unverified and shown as such: SP8's WHO page number (the app now says its page has not been checked).
