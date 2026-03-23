import pandas as pd
from nba_api.stats.endpoints import LeagueGameLog
import time

# Pull game logs for the last 3 seasons
seasons = ['2023-24', '2024-25', '2022-23']
all_games = []

for season in seasons:
    print(f"Pulling {season}...")
    log = LeagueGameLog(season=season, season_type_all_star='Regular Season')
    df = log.get_data_frames()[0]
    df['SEASON'] = season
    all_games.append(df)
    time.sleep(1)  # be nice to the API

games = pd.concat(all_games, ignore_index=True)
print(f"Total rows: {len(games)}")
print(games.columns.tolist())
games.to_csv('raw_game_logs.csv', index=False)
print("Saved to raw_game_logs.csv")