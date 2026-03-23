Building chatbot to analyze and query sport data. 
Leveraging various AI frameworks to build the application including Langchain for integration, langgraph for orchestration, langfuse for evals and observability. 
Sports data from various document types is being stored in vector databases weaviate.

Logistic regression model trained on 3 seasons of NBA game data (7,200+ games) pulled via the NBA Stats API, using rolling 20-game net rating differentials, win percentage differentials, possession pace differentials, and home court advantage as features to predict game outcomes at 64% accuracy. Includes a real-time prediction CLI that ingests current-season data and outputs win probabilities for any matchup.
