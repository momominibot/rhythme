/* Primary-source safety receipts checked 2026-09-30.
   Verification applies to supporting passages, not clinical validation of Rhythme.
   Retrieval limits and changes are documented in docs/readiness/TARGETED-SAFETY-REVIEW.md. */
window.SAFETY_EVIDENCE = {
  "mental-health-scope": {
    "claim": "A descriptive mood check-in is not a depression assessment. Continuing or concerning symptoms deserve professional support.",
    "evidence": "NHS guidance recommends seeking help when difficulties continue, worsen or affect coping. Assessment may include a clinician-selected questionnaire. Its postpartum psychosis guidance treats sudden confusion, hallucinations or delusions after birth as requiring urgent assessment. WHO advises contacting emergency services or a crisis line when there is immediate danger of self-harm.",
    "sources": [
      {
        "authors": "NHS",
        "title": "Postnatal depression (reviewed 18 March 2026)",
        "url": "https://www.nhs.uk/mental-health/conditions/postnatal-depression/",
        "year": "2026"
      },
      {
        "authors": "NHS",
        "title": "Postpartum psychosis (reviewed 18 October 2023)",
        "url": "https://www.nhs.uk/mental-health/conditions/post-partum-psychosis/",
        "year": "2023"
      },
      {
        "authors": "World Health Organization",
        "title": "Suicide: questions and answers (31 August 2026)",
        "url": "https://www.who.int/news-room/questions-and-answers/item/suicide",
        "year": "2026"
      }
    ],
    "limitations": "These source passages support educational copy only. They do not validate Rhythme as a diagnostic, screening, fertility, contraception or treatment tool. Clinical review of the app remains pending. The mood choices on this page are original, non-scored reflection prompts, not an EPDS implementation. NHS clinical descriptions are used without importing UK phone numbers or access pathways worldwide.",
    "supportingPassages": [
      {
        "url": "https://www.nhs.uk/mental-health/conditions/postnatal-depression/",
        "section": "If you’re not sure it’s postnatal depression; How postnatal depression is diagnosed",
        "quote": "It's important to get help even if you only have some of the signs."
      },
      {
        "url": "https://www.nhs.uk/mental-health/conditions/post-partum-psychosis/",
        "section": "When to get medical help",
        "quote": "request an urgent assessment on the same day"
      }
    ],
    "level": "guidance",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-30",
      "scope": "Supporting source passages checked; this is not clinical validation or regulatory approval of the app."
    },
    "wellnessNote": "Bring persistent or concerning symptoms to a qualified healthcare professional. For immediate danger use local emergency services."
  },
  "mental-health-support-worldwide": {
    "claim": "Use local emergency services for immediate danger and reach out to a trusted person or health professional. Country-specific helplines can be found in an external directory.",
    "evidence": "WHO recommends speaking with someone trusted and a health worker, and using emergency services or a crisis line for immediate danger. Find A Helpline provides country selection and service descriptions with contact methods. Check the relevant service’s hours, languages and eligibility; a directory is not an emergency dispatcher.",
    "sources": [
      {
        "authors": "World Health Organization",
        "title": "Suicide: questions and answers (31 August 2026)",
        "url": "https://www.who.int/news-room/questions-and-answers/item/suicide",
        "year": "2026"
      },
      {
        "authors": "ThroughLine / Find A Helpline",
        "title": "Find A Helpline: country and contact options",
        "url": "https://findahelpline.com/"
      }
    ],
    "limitations": "These source passages support educational copy only. They do not validate Rhythme as a diagnostic, screening, fertility, contraception or treatment tool. Clinical review of the app remains pending. Find A Helpline is a third-party contact directory, not a medical guideline. Rhythme has not verified every listing or a service response time, and does not share check-in answers with it. No country or phone number is assumed.",
    "supportingPassages": [
      {
        "url": "https://www.who.int/news-room/questions-and-answers/item/suicide",
        "section": "Do you feel like life is not worth living? What you can do",
        "quote": "Talk to someone you trust about how you feel."
      },
      {
        "url": "https://findahelpline.com/",
        "section": "Country input and How do I find the best helpline for me?",
        "quote": "Start typing your country..."
      }
    ],
    "level": "guidance",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-30",
      "scope": "Supporting source passages checked; this is not clinical validation or regulatory approval of the app."
    },
    "wellnessNote": "Bring persistent or concerning symptoms to a qualified healthcare professional. For immediate danger use local emergency services."
  },
  "straw10": {
    "claim": "STRAW+10 describes reproductive-aging patterns in context. Age alone and a few cycle entries do not establish a personal stage.",
    "evidence": "The 2012 consensus gives menstrual patterns a central role and does not use age as a staging criterion. Biomarkers have assay and population limitations. NICE identifies menopause in otherwise healthy people aged 45 or over with symptoms after at least 12 months without a period when they are not using hormonal contraception. Different histories require clinical interpretation.",
    "sources": [
      {
        "authors": "STRAW+10 Collaborative Group / ASRM",
        "title": "Executive summary of the Stages of Reproductive Aging Workshop + 10: addressing the unfinished agenda of staging reproductive aging",
        "url": "https://prod.asrm.org/practice-guidance/practice-committee-documents/executive-summary-of-the-stages-of-reproductive-aging-workshopd10-addressing-the-unfinished-agenda-of-staging-reproductive-aging-2012/",
        "year": "2012"
      },
      {
        "authors": "NICE",
        "title": "NG23 Menopause: identification and management, recommendations 1.3.1 to 1.3.5",
        "url": "https://www.nice.org.uk/guidance/ng23/chapter/Recommendations",
        "year": "2015, amended 2024"
      }
    ],
    "limitations": "These source passages support educational copy only. They do not validate Rhythme as a diagnostic, screening, fertility, contraception or treatment tool. Clinical review of the app remains pending. This page summarizes typed observations only and does not implement staging criteria. Pregnancy, breastfeeding, hormonal treatment, PCOS, primary ovarian insufficiency, hysterectomy and treatment history can complicate interpretation. ASRM and NICE are different guidance bodies, not independent trials validating an app. The ASRM full text was retrieved through its indexed first-party page after direct open failed; NICE recommendations were read from indexed first-party content. This record replaces legacy citation metadata without reusing an unconfirmed PMID or DOI.",
    "supportingPassages": [
      {
        "url": "https://prod.asrm.org/practice-guidance/practice-committee-documents/executive-summary-of-the-stages-of-reproductive-aging-workshopd10-addressing-the-unfinished-agenda-of-staging-reproductive-aging-2012/",
        "section": "Inclusiveness of the STRAW+10 criteria",
        "quote": "does not use age as a criterion for determining reproductive staging"
      },
      {
        "url": "https://www.nice.org.uk/guidance/ng23/chapter/Recommendations",
        "section": "Recommendation 1.3.1",
        "quote": "at least 12 months and are not using hormonal contraception"
      }
    ],
    "level": "guidance",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-30",
      "scope": "Supporting source passages checked; this is not clinical validation or regulatory approval of the app."
    },
    "wellnessNote": "Bring persistent or concerning symptoms to a qualified healthcare professional. For immediate danger use local emergency services."
  },
  "foot-care-safety": {
    "claim": "Foot-care precautions take priority over a comfort ritual. People with diabetes should avoid soaking and follow their foot-care team’s guidance.",
    "evidence": "CDC advises warm, not hot, washing and no foot soaking for diabetes. Reduced sensation can make heat injury hard to notice. The NHS trust’s general foot-care page advises warm washing, careful drying and no soaking longer than 10 minutes; it directs people with diabetes or poor circulation to a clinician.",
    "sources": [
      {
        "authors": "CDC",
        "title": "Your Feet and Diabetes (May 2024)",
        "url": "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html",
        "year": "2024"
      },
      {
        "authors": "Guy’s and St Thomas’ NHS Foundation Trust",
        "title": "Falls: keeping your feet healthy",
        "url": "https://www.guysandstthomas.nhs.uk/health-information/falls/keeping-your-feet-healthy"
      }
    ],
    "limitations": "These source passages support educational copy only. They do not validate Rhythme as a diagnostic, screening, fertility, contraception or treatment tool. Clinical review of the app remains pending. These are foot-care recommendations, not evidence that soaking improves fertility, hormones, menstrual pain or sleep. The NHS page sits within falls guidance, not a trial in pregnant or menstruating users. The CDC no-soak advice for diabetes takes priority over the general duration limit. A 10-minute limit is not a prescribed frequency or treatment dose.",
    "supportingPassages": [
      {
        "url": "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html",
        "section": "Tips for healthy feet",
        "quote": "Don't soak your feet."
      },
      {
        "url": "https://www.guysandstthomas.nhs.uk/health-information/falls/keeping-your-feet-healthy",
        "section": "Washing your feet",
        "quote": "Do not soak your feet for longer than 10 minutes."
      }
    ],
    "level": "guidance",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-30",
      "scope": "Supporting source passages checked; this is not clinical validation or regulatory approval of the app."
    },
    "wellnessNote": "Bring persistent or concerning symptoms to a qualified healthcare professional. For immediate danger use local emergency services."
  },
  "tcm-evidence-limits": {
    "claim": "TCM tradition and clinical evidence must be distinguished. Herbal products need appropriate safety advice, particularly during pregnancy or breastfeeding.",
    "evidence": "NCCIH describes mixed or limited evidence for Chinese herbal products and documented product-safety concerns. It advises discussing TCM with healthcare providers and taking particular care during pregnancy, nursing or treatment of a child. FDA advises discussing ingested dietary supplements with a doctor or pharmacist because interactions and side effects can occur.",
    "sources": [
      {
        "authors": "NCCIH / US National Institutes of Health",
        "title": "Traditional Chinese Medicine: What You Need To Know",
        "url": "https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know"
      },
      {
        "authors": "US FDA",
        "title": "Questions and Answers on Dietary Supplements",
        "url": "https://www.fda.gov/food/information-consumers-using-dietary-supplements/questions-and-answers-dietary-supplements"
      }
    ],
    "limitations": "These source passages support educational copy only. They do not validate Rhythme as a diagnostic, screening, fertility, contraception or treatment tool. Clinical review of the app remains pending. These sources do not establish the efficacy or safety of a particular foot-bath herb formula. FDA dietary-supplement guidance applies to ingestion, not topical foot baths. Traditional Qi language is not a measured diagnosis or evidence of hormone, ovarian-reserve or fertility changes. This page provides no herb formula, dosage, frequency or pregnancy treatment recommendation.",
    "supportingPassages": [
      {
        "url": "https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know",
        "section": "More To Consider",
        "quote": "Don’t use TCM to replace or delay seeking conventional care."
      },
      {
        "url": "https://www.fda.gov/food/information-consumers-using-dietary-supplements/questions-and-answers-dietary-supplements",
        "section": "Should I check with my doctor or health care provider before using a dietary supplement?",
        "quote": "talk to their doctor, pharmacist, or other health care professional"
      }
    ],
    "level": "guidance",
    "verification": {
      "status": "verified",
      "checkedAt": "2026-09-30",
      "scope": "Supporting source passages checked; this is not clinical validation or regulatory approval of the app."
    },
    "wellnessNote": "Bring persistent or concerning symptoms to a qualified healthcare professional. For immediate danger use local emergency services."
  }
};
