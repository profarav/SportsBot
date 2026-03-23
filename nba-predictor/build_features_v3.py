import pandas as pd

games = pd.read_csv('raw_game_logs.csv')

games['WIN'] = (games['WL'] == 'W').astype(int)
games['GAME_DATE'] = pd.to_datetime(games['GAME_DATE'])
games = games.sort_values(['TEAM_ABBREVIATION', 'GAME_DATE'])

# Estimate possessions per game
games['POSS'] = games['FGA'] - games['OREB'] + games['TOV'] + (0.44 * games['FTA'])

# Offensive and defensive rating per game
games['OFF_RTG'] = (games['PTS'] / games['POSS']) * 100

# For defensive rating we need opponent's points in the same game
games['HOME'] = games['MATCHUP'].str.contains('vs.').astype(int)
games['OPP'] = games['MATCHUP'].str.extract(r'(?:vs\. |@ )(\w+)')

# Get opponent points and possessions for each game
opp_pts = games[['GAME_ID', 'TEAM_ABBREVIATION', 'PTS', 'POSS']].copy()
opp_pts.columns = ['GAME_ID', 'OPP', 'OPP_PTS', 'OPP_POSS']
games = games.merge(opp_pts, on=['GAME_ID', 'OPP'], how='left')

games['DEF_RTG'] = (games['OPP_PTS'] / games['POSS']) * 100
games['NET_RTG'] = games['OFF_RTG'] - games['DEF_RTG']

# Features to roll
feature_cols = ['FG_PCT', 'FG3_PCT', 'FT_PCT', 'OREB', 'DREB',
                'AST', 'STL', 'BLK', 'TOV', 'PTS',
                'OFF_RTG', 'DEF_RTG', 'NET_RTG', 'POSS']

# Rolling 20-game averages for ratings, 10 for box score stats
rolling_frames = []
for team, team_df in games.groupby('TEAM_ABBREVIATION'):
    team_df = team_df.copy()
    team_df['ROLL_WIN_PCT'] = team_df['WIN'].shift(1).rolling(10, min_periods=5).mean()
    for col in ['OFF_RTG', 'DEF_RTG', 'NET_RTG', 'POSS']:
        team_df[f'ROLL_{col}'] = team_df[col].shift(1).rolling(20, min_periods=10).mean()
    for col in ['FG_PCT', 'FG3_PCT', 'FT_PCT', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TOV', 'PTS']:
        team_df[f'ROLL_{col}'] = team_df[col].shift(1).rolling(10, min_periods=5).mean()
    rolling_frames.append(team_df)

games = pd.concat(rolling_frames, ignore_index=True)

# Opponent rolling stats
roll_cols = ['ROLL_WIN_PCT'] + [f'ROLL_{c}' for c in feature_cols]
opp_lookup = games[['GAME_ID', 'TEAM_ABBREVIATION'] + roll_cols].copy()
opp_lookup.columns = ['GAME_ID', 'OPP'] + [f'OPP_{c}' for c in roll_cols]
games = games.merge(opp_lookup, on=['GAME_ID', 'OPP'], how='left')

# Diff features only
diff_cols = []
for col in roll_cols:
    diff_name = f'DIFF_{col}'
    games[diff_name] = games[col] - games[f'OPP_{col}']
    diff_cols.append(diff_name)

all_features = diff_cols + ['HOME']
games = games.dropna(subset=all_features)

print(f"Rows: {len(games)}")
print(f"Features ({len(all_features)}): {all_features}")
print(games[['TEAM_ABBREVIATION', 'OPP', 'WIN', 'DIFF_ROLL_OFF_RTG', 'DIFF_ROLL_DEF_RTG', 'DIFF_ROLL_NET_RTG', 'DIFF_ROLL_WIN_PCT']].head(10))

games.to_csv('features_v3.csv', index=False)
print("Saved to features_v3.csv")