import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import pickle

games = pd.read_csv('features_v3.csv')

X = games[['DIFF_ROLL_NET_RTG', 'DIFF_ROLL_WIN_PCT', 'HOME', 'DIFF_ROLL_POSS']]
y = games['WIN']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Normalize so all features are on the same scale
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print(f"Train: {len(X_train)} | Test: {len(X_test)}")

lr = LogisticRegression(max_iter=1000)
lr.fit(X_train_scaled, y_train)
print(f"Logistic Regression: {accuracy_score(y_test, lr.predict(X_test_scaled)):.3f}")

xgb = XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42)
xgb.fit(X_train_scaled, y_train)
print(f"XGBoost: {accuracy_score(y_test, xgb.predict(X_test_scaled)):.3f}")

# Save both model and scaler
with open('model.pkl', 'wb') as f:
    pickle.dump(lr, f)
with open('scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)
print("Saved")