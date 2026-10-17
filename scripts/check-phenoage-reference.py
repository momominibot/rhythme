#!/usr/bin/env python3
"""Independent decimal audit of the clinical PhenotypicAge equation.

No third-party Python packages, network access, app writes, or patient data.
Run from the repository: python3 scripts/check-phenoage-reference.py
Node is used only to compare the actual browser calculator with decimal fixtures.
Sources and limitations: docs/readiness/PHENOAGE-METHOD-RESOLUTION.md.
"""
from decimal import Decimal as D, getcontext
from pathlib import Path
import json
import os
import subprocess

getcontext().prec = 65
COEFFICIENTS = {
    'intercept': '-19.9067', 'albumin': '-.0336', 'creatinine': '.0095',
    'glucose': '.1953', 'crp': '.0954', 'lymphocyte_pct': '-.0120',
    'mcv': '.0268', 'rdw': '.3306', 'alkaline_phosphatase': '.0019',
    'wbc': '.0554', 'age': '.0804',
}
BIOAGE_COEFFICIENTS = {
    'intercept': '-19.90667', 'albumin': '-.03359355', 'creatinine': '.009506491',
    'glucose': '.1953192', 'crp': '.09536762', 'lymphocyte_pct': '-.01199984',
    'mcv': '.02676401', 'rdw': '.3306156', 'alkaline_phosphatase': '.001868778',
    'wbc': '.05542406', 'age': '.08035356',
}
SI = {k: D(v) for k, v in dict(age='40', albumin='42', creatinine='70',
    glucose='5.1', crp='.1', lymphocyte_pct='32', mcv='90', rdw='13',
    alkaline_phosphatase='70', wbc='6').items()}
UNITS = dict(albumin='g/L', creatinine='µmol/L', glucose='mmol/L', crp='mg/dL',
    lymphocyte_pct='%', mcv='fL', rdw='%', alkaline_phosphatase='U/L', wbc='10³/µL')


def reference(values, coefficients=COEFFICIENTS, gamma='.0076927',
              shortcut=False, scale='.00553', intercept='141.50225', denominator='.090165'):
    """Evaluate the ORIGINAL CDF and inverse at 65 decimal digits, not app algebra."""
    xb = D(coefficients['intercept'])
    for key, coefficient in coefficients.items():
        if key != 'intercept':
            term = values[key].ln() if key == 'crp' else values[key]
            xb += D(coefficient) * term
    factor = D('1.51714') if shortcut else (D(120) * D(gamma)).exp() - 1
    h = xb.exp() * factor / D(gamma)
    mortality = 1 - (-h).exp()
    age = D(intercept) + (D(scale) * (-(1 - mortality).ln())).ln() / D(denominator)
    return dict(xb=xb, H=h, M=mortality, phenoAge=age)


def close(actual, expected, tolerance='1e-50'):
    assert abs(D(str(actual)) - D(str(expected))) < D(tolerance), (actual, expected)


def panel(values):
    return {key: dict(value=float(values[key]), unit=unit) for key, unit in UNITS.items()}


def main():
    original = reference(SI)
    close(original['phenoAge'], '33.00568764200931521198189345290215801154532366323339835846162101')
    # Source-consistent variants are separate calculations; never hybridize their coefficients.
    plos = reference(SI, coefficients={**COEFFICIENTS, 'intercept': '-19.907',
        'alkaline_phosphatase': '.00188'}, shortcut=True, intercept='141.50', denominator='.09165')
    close(plos['phenoAge'], '34.74284074145169038187577472153135588525523157554773393455518965')
    bioage = reference(SI, coefficients=BIOAGE_COEFFICIENTS, gamma='.007692696',
        shortcut=True, scale='.0055305')
    close(bioage['phenoAge'], '32.94011473087011058122877030821597992468861829132896021637341244')
    denominator_only = reference(SI, denominator='.09165')
    close(denominator_only['phenoAge'], '34.76365158201603825519200679957362877371504755150506669929833124')

    # Concrete conventional-unit fixture, using exact decimal representations of the
    # declared conversion factors. 0.8 mg/dL creatinine is 70.72 µmol/L, not 70.
    converted = {**SI, 'albumin': D('4.2') * 10, 'creatinine': D('.8') * D('88.4'),
                 'glucose': D('91.89282') / D('18.0182'), 'crp': D('1') / 10}
    assert converted['albumin'] == 42 and converted['creatinine'] == D('70.72')
    assert converted['glucose'] == D('5.1') and converted['crp'] == D('.1')
    us_reference = reference(converted)
    close(us_reference['phenoAge'], '33.08154856365296851426104833561718047037081027111894152931505639')
    us_panel = {**panel(SI), 'albumin': dict(value=4.2, unit='g/dL'),
                'creatinine': dict(value=.8, unit='mg/dL'),
                'glucose': dict(value=91.89282, unit='mg/dL'),
                'crp': dict(value=1, unit='mg/L'), 'wbc': dict(value=6, unit='10⁹/L')}
    fixtures = [dict(panel=panel(SI), expected=str(original['phenoAge'])),
                dict(panel=us_panel, expected=str(us_reference['phenoAge'])),
                dict(panel=panel(converted), expected=str(us_reference['phenoAge']))]
    # Decimal reference also checks the mathematical CRP log conversion consequence.
    wrong_crp = reference({**SI, 'crp': D('1')})['phenoAge']
    close(wrong_crp-original['phenoAge'], D('.0954') * D(10).ln() / D('.090165'))

    repo = Path(__file__).resolve().parents[1]
    if not (repo / 'bio-age.js').exists():
        repo = Path(os.environ.get('OVULUNA_REPO', '/Users/michiyomimi/Desktop/ovuluna-doubao'))
    node_code = r"""
const fs = require('node:fs'), vm = require('node:vm');
const fixtures = JSON.parse(fs.readFileSync(0, 'utf8'));
const window = {};
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), {window});
const api = window.OvulunaWellness;
if(api.MODEL_VERSION !== 'levine-2018-published-coefficients-v1') throw Error('Review model-version change');
const rows = fixtures.map(f => {
  const result = api.calculatePhenoAge(f.panel, 40);
  if(result.error || Math.abs(result.phenoAge - Number(f.expected)) > 1e-10) throw Error(JSON.stringify(result));
  return {actual:result.phenoAge, expected:f.expected};
});
process.stdout.write(JSON.stringify(rows));
"""
    executed = subprocess.run([os.environ.get('NODE', 'node'), '-e', node_code, str(repo / 'bio-age.js')],
        input=json.dumps(fixtures), text=True, check=True, capture_output=True)
    report = {label: {k: str(v) for k, v in values.items()} for label, values in [
        ('aging2018_published', original), ('plos2019_literal_print', plos),
        ('bioage_2026_source_precision', bioage), ('denominator_only_counterfactual', denominator_only),
        ('conventional_unit_fixture', us_reference)]}
    report['actual_browser_calculator_fixtures'] = json.loads(executed.stdout)
    report['status'] = 'PASS: decimal source equations, explicit unit fixture, CRP log order, and actual browser calculator agreement'
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
