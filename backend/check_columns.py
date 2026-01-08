import pandas as pd

df = pd.read_csv('data/Mobiles Dataset (2025).csv', encoding='latin1')
print("Original column names:")
for i, col in enumerate(df.columns):
    print(f"{i}: '{col}' (repr: {repr(col)})")

df.columns = df.columns.str.strip()
print("\nAfter stripping:")
for i, col in enumerate(df.columns):
    print(f"{i}: '{col}'")

print("\nFirst row data:")
print(df.head(1).to_dict('records')[0])
