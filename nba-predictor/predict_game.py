import pandas as pd
import pickle
from nba_api.stats.endpoints import LeagueGameLog

with open('model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

# Pull current season data
print("Pulling 2025-26 season data...")
log = LeagueGameLog(season='2025-26', season_type_all_star='Regular Season')
games = log.get_data_frames()[0]

games['GAME_DATE'] = pd.to_datetime(games['GAME_DATE'])
games = games.sort_values(['TEAM_ABBREVIATION', 'GAME_DATE'])

# Calculate per-game stats
games['POSS'] = games['FGA'] - games['OREB'] + games['TOV'] + (0.44 * games['FTA'])
games['OFF_RTG'] = (games['PTS'] / games['POSS']) * 100

# Get opponent info for defensive rating
games['OPP'] = games['MATCHUP'].str.extract(r'(?:vs\. |@ )(\w+)')
opp_pts = games[['GAME_ID', 'TEAM_ABBREVIATION', 'PTS', 'POSS']].copy()
opp_pts.columns = ['GAME_ID', 'OPP', 'OPP_PTS', 'OPP_POSS']
games = games.merge(opp_pts, on=['GAME_ID', 'OPP'], how='left')
games['DEF_RTG'] = (games['OPP_PTS'] / games['POSS']) * 100
games['NET_RTG'] = games['OFF_RTG'] - games['DEF_RTG']
games['WIN'] = (games['WL'] == 'W').astype(int)

# Build rolling stats per team
teams = {}
for team, team_df in games.groupby('TEAM_ABBREVIATION'):
    team_df = team_df.sort_values('GAME_DATE')
    last20_net = team_df['NET_RTG'].tail(20).mean()
    last20_poss = team_df['POSS'].tail(20).mean()
    last10_wins = team_df['WIN'].tail(10).mean()
    teams[team] = {
        'NET_RTG': last20_net,
        'POSS': last20_poss,
        'WIN_PCT': last10_wins
    }

print(f"\nLoaded {len(teams)} teams. Current rolling stats ready.\n")

# Predict
while True:
    home = input("Home team (abbreviation, e.g. LAL): ").strip().upper()
    away = input("Away team (abbreviation, e.g. BOS): ").strip().upper()

    if home not in teams or away not in teams:
        print(f"Team not found. Available: {sorted(teams.keys())}")
        continue

    home_stats = teams[home]
    away_stats = teams[away]

    home_features = pd.DataFrame([{
    'DIFF_ROLL_NET_RTG': home_stats['NET_RTG'] - away_stats['NET_RTG'],
    'DIFF_ROLL_WIN_PCT': home_stats['WIN_PCT'] - away_stats['WIN_PCT'],
    'HOME': 1,
    'DIFF_ROLL_POSS': home_stats['POSS'] - away_stats['POSS']
}])

    away_features = pd.DataFrame([{
    'DIFF_ROLL_NET_RTG': away_stats['NET_RTG'] - home_stats['NET_RTG'],
    'DIFF_ROLL_WIN_PCT': away_stats['WIN_PCT'] - home_stats['WIN_PCT'],
    'HOME': 0,
    'DIFF_ROLL_POSS': away_stats['POSS'] - home_stats['POSS']
}])
    home_prob = model.predict_proba(scaler.transform(home_features))[0][1]
    away_prob = model.predict_proba(scaler.transform(away_features))[0][1]

    print(f"\n{'='*40}")
    print(f"  {home} (home): {home_prob:.1%} win probability")
    print(f"  {away} (away): {away_prob:.1%} win probability")
    print(f"  Prediction: {home if home_prob > away_prob else away} wins")
    print(f"{'='*40}")

    print(f"\n  {home} rolling NET RTG: {home_stats['NET_RTG']:+.1f} | Last 10 win%: {home_stats['WIN_PCT']:.0%}")
    print(f"  {away} rolling NET RTG: {away_stats['NET_RTG']:+.1f} | Last 10 win%: {away_stats['WIN_PCT']:.0%}\n")

    again = input("Another matchup? (y/n): ").strip().lower()
    if again != 'y':
        break