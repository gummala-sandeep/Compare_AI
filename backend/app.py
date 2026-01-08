import os
import warnings
import pandas as pd
import numpy as np
import faiss
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from sentence_transformers import SentenceTransformer

# Suppress deprecation warning for google.generativeai
warnings.filterwarnings("ignore", message=".*google.generativeai.*")
import google.generativeai as genai

DATASET_PATH = "data/Mobiles Dataset (2025).csv"
TOP_K = 5

# =========================
# APP INIT
# =========================
app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)
CORS(app)

# =========================
# LOAD DATA
# =========================
df = pd.read_csv(DATASET_PATH, encoding="latin1")
# Strip whitespace and special characters from column names
df.columns = df.columns.str.strip().str.lstrip('`')

chunks = []
for _, row in df.iterrows():
    text = f"""
    Mobile Name: {row['Company Name']} {row['Model Name']}
    RAM: {row['RAM']}
    Processor: {row['Processor']}
    Battery Capacity: {row['Battery Capacity']}
    Screen Size: {row['Screen Size']}
    Price in India: {row['Launched Price (India)']}
    """
    chunks.append(text.strip())

# =========================
# EMBEDDINGS + FAISS
# =========================
embedder = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = embedder.encode(chunks, show_progress_bar=True)

index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(np.array(embeddings))

# =========================
# GEMINI SETUP
# =========================
genai.configure(api_key="YOUR_GEMINI_API_KEY_HERE")
gemini = genai.GenerativeModel("gemini-2.5-flash")

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/products", methods=["GET"])
def get_products():
    """Return list of unique products from the dataset"""
    products = []
    for _, row in df.iterrows():
        product_name = f"{row['Company Name']} {row['Model Name']}"
        products.append({
            "id": product_name.lower().replace(" ", "-"),
            "name": product_name
        })
    # Remove duplicates while preserving order
    seen = set()
    unique_products = []
    for p in products:
        if p['id'] not in seen:
            seen.add(p['id'])
            unique_products.append(p)
    return jsonify(unique_products)

@app.route("/api/chatbot", methods=["POST"])
def chatbot():
    data = request.json
    user_question = data.get("question")
    selected_product = data.get("product", "")  # Get the selected product
    
    # Convert product ID back to name (e.g., "apple-iphone-16-128gb" -> "Apple iPhone 16 128GB")
    product_name = selected_product.replace("-", " ").title() if selected_product else ""
    
    # Combine product name with question for better search
    search_query = f"{product_name} {user_question}"
    
    query_vec = embedder.encode([search_query])
    _, indices = index.search(query_vec, TOP_K)

    context = "\n\n".join(chunks[i] for i in indices[0])

    prompt = f"""
    Answer the following question about {product_name if product_name else 'mobile phones'}.
    Only use the information provided in the context below.
    If the specific information is not available in the context, say so.
    
    Question: {user_question}

    Context:
    {context}
    """

    response = gemini.generate_content(prompt)

    return jsonify({
        "answer": response.text,
        "dataAvailable": True
    })

@app.route("/api/compare", methods=["POST"])
def compare():
    data = request.json
    product_a_id = data.get("productA", "")
    product_b_id = data.get("productB", "")
    spec = data.get("specification", "")
    
    # Convert product IDs back to names
    product_a_name = product_a_id.replace("-", " ").title() if product_a_id else ""
    product_b_name = product_b_id.replace("-", " ").title() if product_b_id else ""
    
    # Find product data in dataframe
    def find_product_data(product_name):
        for _, row in df.iterrows():
            full_name = f"{row['Company Name']} {row['Model Name']}"
            if full_name.lower().replace(" ", "-") == product_name.lower().replace(" ", "-"):
                return {
                    "name": full_name,
                    "RAM": row.get('RAM', 'N/A'),
                    "Processor": row.get('Processor', 'N/A'),
                    "Battery Capacity": row.get('Battery Capacity', 'N/A'),
                    "Screen Size": row.get('Screen Size', 'N/A'),
                    "Price": row.get('Launched Price (India)', 'N/A'),
                    "Weight": row.get('Mobile Weight', 'N/A'),
                    "Front Camera": row.get('Front Camera', 'N/A'),
                    "Back Camera": row.get('Back Camera', 'N/A')
                }
        return None
    
    product_a_data = find_product_data(product_a_id)
    product_b_data = find_product_data(product_b_id)
    
    if not product_a_data or not product_b_data:
        return jsonify({
            "error": "One or both products not found",
            "productAName": product_a_name,
            "productBName": product_b_name,
            "comparisons": []
        })
    
    # Build comparison based on specification
    comparisons = []
    all_specs = ["RAM", "Processor", "Battery Capacity", "Screen Size", "Price", "Weight", "Front Camera", "Back Camera"]
    
    # If "all" selected or empty, compare all specs
    if spec == "all" or not spec:
        matched_specs = all_specs
    else:
        # Use the exact spec value from dropdown
        matched_specs = [spec]
    
    for field in matched_specs:
        comparisons.append({
            "specification": field,
            "productAValue": str(product_a_data.get(field, 'N/A')),
            "productBValue": str(product_b_data.get(field, 'N/A'))
        })
    
    return jsonify({
        "productAName": product_a_data["name"],
        "productBName": product_b_data["name"],
        "comparisons": comparisons
    })

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)
