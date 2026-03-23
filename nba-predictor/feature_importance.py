import pickle
import matplotlib.pyplot as plt
import numpy as np

with open('model.pkl', 'rb') as f:
    model = pickle.load(f)

feature_names = ['NET_RTG_diff', 'WIN_PCT_diff', 'HOME', 'POSS_diff']
weights = model.coef_[0]

# Sort by absolute importance
indices = np.argsort(np.abs(weights))[::-1]
sorted_names = [feature_names[i] for i in indices]
sorted_weights = [weights[i] for i in indices]

# Calculate percentage contribution
total = sum(abs(w) for w in sorted_weights)
percentages = [abs(w) / total * 100 for w in sorted_weights]

plt.figure(figsize=(8, 5))
bars = plt.barh(sorted_names[::-1], percentages[::-1], color='#2196F3')
plt.xlabel('Contribution (%)')
plt.title('What Drives the Prediction?')

# Add percentage labels on bars
for bar, pct in zip(bars, percentages[::-1]):
    plt.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
             f'{pct:.1f}%', va='center')

plt.tight_layout()
plt.savefig('feature_importance.png', dpi=150)
print("Saved to feature_importance.png")

# Print raw weights too
print("\nRaw model weights:")
for name, weight in zip(sorted_names, sorted_weights):
    print(f"  {name}: {weight:+.4f}")