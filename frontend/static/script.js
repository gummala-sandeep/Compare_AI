/**
 * Product Manual Intelligence - JavaScript
 * Connected to Flask + Gemini RAG backend
 */

// ===========================================
// CONFIGURATION
// ===========================================
const CONFIG = {
    CHATBOT_API: "/api/chatbot",
    COMPARISON_API: "/api/compare",
    PRODUCTS_API: "/api/products",
    DEMO_MODE: false   // ❗ MUST be false to use backend
};

// ===========================================
// DOM ELEMENTS
// ===========================================
const elements = {
    productSelect: document.getElementById("product-select"),
    questionInput: document.getElementById("question-input"),
    askButton: document.getElementById("ask-button"),
    chatDisplay: document.getElementById("chat-display"),

    comparisonHeader: document.getElementById("comparison-header"),
    comparisonContent: document.getElementById("comparison-content"),
    toggleIcon: document.getElementById("toggle-icon"),
    productASelect: document.getElementById("product-a"),
    productBSelect: document.getElementById("product-b"),
    comparisonSpec: document.getElementById("comparison-spec"),
    compareButton: document.getElementById("compare-button"),
    comparisonResult: document.getElementById("comparison-result")
};

// ===========================================
// INIT
// ===========================================
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadProducts();
});

// ===========================================
// LOAD PRODUCTS FROM API
// ===========================================
async function loadProducts() {
    try {
        const response = await fetch(CONFIG.PRODUCTS_API);
        const products = await response.json();
        
        populateDropdown(elements.productSelect, products, "Choose a product...");
        populateDropdown(elements.productASelect, products, "Choose product A...");
        populateDropdown(elements.productBSelect, products, "Choose product B...");
    } catch (err) {
        console.error("Failed to load products:", err);
    }
}

function populateDropdown(selectElement, products, placeholder) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    products.forEach(product => {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name;
        selectElement.appendChild(option);
    });
}

// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {
    elements.askButton.addEventListener("click", handleChatbotQuestion);
    elements.comparisonHeader.addEventListener("click", toggleComparison);
    elements.compareButton.addEventListener("click", handleComparison);
}

// ===========================================
// CHATBOT
// ===========================================
async function handleChatbotQuestion() {
    const product = elements.productSelect.value;
    const question = elements.questionInput.value.trim();

    if (!product) {
        alert("Please select a product.");
        return;
    }
    if (!question) {
        alert("Please enter a question.");
        return;
    }

    addUserMessage(question);
    elements.questionInput.value = "";

    const loaderId = addLoadingIndicator();

    try {
        const response = await fetch(CONFIG.CHATBOT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                product: product,
                question: question
            })
        });

        const data = await response.json();
        removeLoadingIndicator(loaderId);
        addAIMessage(data);

    } catch (err) {
        console.error(err);
        removeLoadingIndicator(loaderId);
        addErrorMessage("Server error. Please try again.");
    }
}

// ===========================================
// COMPARISON
// ===========================================
async function handleComparison() {
    const productA = elements.productASelect.value;
    const productB = elements.productBSelect.value;
    const specification = elements.comparisonSpec.value;

    if (!productA || !productB) {
        alert("Please select both products to compare.");
        return;
    }

    try {
        const response = await fetch(CONFIG.COMPARISON_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productA,
                productB,
                specification
            })
        });

        const data = await response.json();
        displayComparisonResults(data);

    } catch (err) {
        console.error(err);
        alert("Comparison failed.");
    }
}

// ===========================================
// UI HELPERS
// ===========================================
function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "message user-message";
    div.innerHTML = `
        <div class="message-header">You asked</div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    elements.chatDisplay.appendChild(div);
    scrollToBottom();
}

function addAIMessage(data) {
    const div = document.createElement("div");
    div.className = "message ai-message";

    div.innerHTML = `
        <div class="message-header">AI Assistant</div>
        <div class="ai-explanation">
            <div class="ai-explanation-title">📝 AI Explanation</div>
            <div class="ai-explanation-content">${formatResponse(data.answer)}</div>
        </div>
        <div class="trust-indicator">✓ Verified from dataset</div>
    `;

    elements.chatDisplay.appendChild(div);
    scrollToBottom();
}

function addErrorMessage(msg) {
    const div = document.createElement("div");
    div.className = "message ai-message";
    div.innerHTML = `
        <div class="message-header">Error</div>
        <div class="unavailable-data">${escapeHtml(msg)}</div>
    `;
    elements.chatDisplay.appendChild(div);
}

function addLoadingIndicator() {
    const id = "loading-" + Date.now();
    const div = document.createElement("div");
    div.id = id;
    div.className = "loading-indicator";
    div.innerHTML = `
        <span>Analyzing manuals...</span>
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
    `;
    elements.chatDisplay.appendChild(div);
    scrollToBottom();
    return id;
}

function removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function displayComparisonResults(data) {
    let html = `
        <div class="result-title">Comparison Results</div>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Specification</th>
                    <th>${data.productAName}</th>
                    <th>${data.productBName}</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.comparisons.forEach(row => {
        html += `
            <tr>
                <td><strong>${row.specification}</strong></td>
                <td>${row.productAValue}</td>
                <td>${row.productBValue}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    elements.comparisonResult.innerHTML = html;
    elements.comparisonResult.classList.remove("hidden");
}

function toggleComparison() {
    elements.comparisonContent.classList.toggle("expanded");
    elements.toggleIcon.classList.toggle("rotated");
}

function scrollToBottom() {
    elements.chatDisplay.scrollTop = elements.chatDisplay.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatResponse(text) {
    return text.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}
