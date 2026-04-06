// Logistic regression model — ported from nba-predictor/model.pkl + scaler.pkl
// Coefficients extracted via: python3 -c "import pickle; ..."
// Features: [DIFF_ROLL_NET_RTG, DIFF_ROLL_WIN_PCT, HOME, DIFF_ROLL_POSS]
// Trained on 3 seasons (2022-23, 2023-24, 2024-25) of NBA game logs
// Test accuracy: 64% (within 3% of Vegas baseline)

const MODEL = {
  coef: [0.7390958167439547, 0.003902992568088127, 0.26043674114615745, -0.05611101894088564],
  intercept: -0.0019754190339681087,
  scaler: {
    mean: [-0.036058652142992635, -0.0009200283085633409, 0.5001769285208776, 0.012228256076954202],
    scale: [8.376264937697192, 0.2992072611284017, 0.49999996869629754, 3.1436832877769283],
  },
} as const;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function standardize(features: number[]): number[] {
  return features.map(
    (x, i) => (x - MODEL.scaler.mean[i]) / MODEL.scaler.scale[i]
  );
}

function logisticPredict(features: number[]): number {
  const scaled = standardize(features);
  const score =
    scaled.reduce((sum, x, i) => sum + x * MODEL.coef[i], 0) + MODEL.intercept;
  return sigmoid(score);
}

export interface PredictionResult {
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;
  awayWinProb: number;
  predictedWinner: string;
  confidence: "high" | "medium" | "low";
  factors: {
    netRatingDiff: number;
    winPctDiff: number;
    homeCourtEdge: number;
    paceDiff: number;
  };
  homeStats: TeamSnapshot;
  awayStats: TeamSnapshot;
}

export interface TeamSnapshot {
  abbreviation: string;
  rollNetRtg: number;
  last10WinPct: number;
  rollPoss: number;
}

export function predictMatchup(
  homeAbbr: string,
  awayAbbr: string,
  homeStats: TeamSnapshot,
  awayStats: TeamSnapshot
): PredictionResult {
  const diffNetRtg = homeStats.rollNetRtg - awayStats.rollNetRtg;
  const diffWinPct = homeStats.last10WinPct - awayStats.last10WinPct;
  const diffPoss = homeStats.rollPoss - awayStats.rollPoss;

  // Home team perspective
  const homeFeatures = [diffNetRtg, diffWinPct, 1, diffPoss];
  // Away team perspective
  const awayFeatures = [-diffNetRtg, -diffWinPct, 0, -diffPoss];

  const homeProb = logisticPredict(homeFeatures);
  const awayProb = logisticPredict(awayFeatures);

  // Normalize so probabilities sum to 1
  const total = homeProb + awayProb;
  const homeWinProb = homeProb / total;
  const awayWinProb = awayProb / total;

  const margin = Math.abs(homeWinProb - awayWinProb);
  const confidence: "high" | "medium" | "low" =
    margin > 0.2 ? "high" : margin > 0.1 ? "medium" : "low";

  return {
    homeTeam: homeAbbr,
    awayTeam: awayAbbr,
    homeWinProb,
    awayWinProb,
    predictedWinner: homeWinProb >= awayWinProb ? homeAbbr : awayAbbr,
    confidence,
    factors: {
      netRatingDiff: diffNetRtg,
      winPctDiff: diffWinPct,
      homeCourtEdge: sigmoid(MODEL.coef[2] * ((1 - MODEL.scaler.mean[2]) / MODEL.scaler.scale[2])) - 0.5,
      paceDiff: diffPoss,
    },
    homeStats,
    awayStats,
  };
}
