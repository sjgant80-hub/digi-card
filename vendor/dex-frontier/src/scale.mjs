// src/scale.mjs — organ 6, SCALE: more silos, more nodes. The same two real datasets cut finer, the way a larger company
// holds them: every team its own records. Telco into 7 silos, the shop into 6; every column in exactly one silo. A finer
// silo knows less on its own, so the question scale asks is whether the composed answer keeps climbing as nodes join,
// toward the model that pools every record in one place. Pure: definitions and a view builder (silos.mjs's shape).
export const FINE = {
  telco: {
    demographics: ['gender', 'SeniorCitizen', 'Partner', 'Dependents'], phone: ['PhoneService', 'MultipleLines'], internet: ['InternetService'],
    protection: ['OnlineSecurity', 'OnlineBackup', 'DeviceProtection', 'TechSupport'], streaming: ['StreamingTV', 'StreamingMovies'],
    contract: ['tenure', 'Contract', 'PaperlessBilling', 'ElectronicCheck', 'AutoPay'], charges: ['MonthlyCharges', 'TotalCharges'],
  },
  shop: {
    admin: ['Administrative', 'Administrative_Duration'], info: ['Informational', 'Informational_Duration'], product: ['ProductRelated', 'ProductRelated_Duration'],
    engagement: ['BounceRates', 'ExitRates'], value: ['PageValues'], context: ['SpecialDay', 'OperatingSystems', 'Browser', 'Region', 'TrafficType', 'VisitorType', 'Weekend'],
  },
};

/** one fine silo as a node sees it: only its columns, grown on FIT and graded on GATE */
export function fine(ds, name) {
  const features = FINE[ds.name] && FINE[ds.name][name];
  if (!features) return { ok: false, error: 'no fine silo ' + name + ' in ' + ds.name };
  return { ok: true, name: ds.name + '-' + name, features, cols: Object.fromEntries(features.map((f) => [f, ds.cols[f]])), y: ds.y, n: ds.n, trainRows: ds.fitRows, heldRows: ds.gateRows };
}

/** the fine silos of a domain, by name */
export const fineNames = (ds) => Object.keys(FINE[ds.name] || {});
