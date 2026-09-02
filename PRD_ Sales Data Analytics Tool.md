# Product Requirements Document: Sales Data Analytics Tool (Enhanced)

## 1\. Executive Summary

**Goal:** To provide a lightweight, privacy-focused, single-page application that allows users to upload sales data (CSV) and generate instant visual analytics and AI-driven insights without the need for a backend server or complex installation.

**Core Value Proposition:** "Instant business intelligence from a CSV file, powered by your choice of LLM."

---

## 2\. Target Audience

* **Small Business Owners:** Who have sales exports but lack advanced data analysis skills.  
* **Sales Analysts:** Who need a quick way to visualize trends without importing data into a heavy BI tool (like Tableau or PowerBI).  
* **Privacy-Conscious Users:** Who prefer their data to remain in the browser rather than being uploaded to a third-party cloud server.

---

## 3\. Functional Requirements

### 3.1 Data Ingestion & Processing

* **File Upload:** A drag-and-drop or file-picker interface for `.csv` files.  
* **Data Validation:** The tool must verify that the CSV contains the required columns: `Date`, `Article ID`, `Country Code`, and `Sold Units`. If columns are missing, a clear error message should be displayed.  
* **Date Normalization:** Automatically detect and convert integer-based date formats (e.g., YYYYMMDD) into standard JavaScript Date objects for time-series analysis.  
* **Client-Side Processing:** All data parsing must happen in the browser (using libraries like PapaParse) to ensure maximum privacy.

### 3.2 Interactive Analytics & Visualization

* **Dynamic Charting:** A primary time-series chart showing "Units Sold" over time.  
* **Filtering System:**  
  * **Product Filter:** Dropdown to select one or multiple `Article IDs`.  
  * **Geography Filter:** Dropdown to filter by `Country Code`.  
* **Aggregation Toggles:** Users can switch the chart granularity between **Daily**, **Weekly**, and **Monthly** views.  
* **Summary Dashboard (KPI Cards):**  
  * **Total Volume:** Sum of all sold units in the current filtered view.  
  * **Top Performer:** The Article ID with the highest sales volume.  
  * **Bottom Performer:** The Article ID with the lowest sales volume.  
  * **Geographic Distribution:** A breakdown of sales by country (e.g., a sorted list or small bar chart).

### 3.3 Customizable LLM AI Integration

To ensure flexibility, the tool will not be locked to one provider but will support any **OpenAI-compatible API**.

* **Configuration Panel (Settings):** A collapsible settings menu where users can define:  
  * **API Endpoint:** (e.g., `https://api.openai.com/v1` or a local Ollama endpoint).  
  * **API Key:** Securely stored in the browser's `localStorage`.  
  * **Model Name:** (e.g., `gemma4free`, `q38-27bfast`, `gemma4freefastqat`).  
  * **System Prompt:** A customizable instruction set telling the AI how to behave (e.g., *"You are a senior sales analyst. Provide concise, actionable insights based on the provided data."*).  
  * **Temperature:** A slider (0.0 to 1.0) to control the creativity/determinism of the analysis.  
* **AI Analysis Workflow:**  
  * The tool will extract the *filtered* summary statistics and trends (not the raw CSV, to save tokens) and send them as a prompt to the LLM.  
  * **Trigger:** A "Generate AI Insights" button that sends the current state of the dashboard to the API.  
* **Fallback Mode:** If no API key is provided or the request fails, the tool will display a **"Statistical Summary"** (standard mean, median, and growth rate calculations) instead of an empty panel.

---

## 4\. User Experience (UX) & Interface

* **Layout:**  
  * **Top Bar:** File upload and Global Settings.  
  * **Left Sidebar:** Filters (Product, Country, Time Aggregation).  
  * **Center Stage:** Main Chart and KPI Cards.  
  * **Right/Bottom Panel:** AI Analysis window with a "Copy to Clipboard" button for the generated report.  
* **State Persistence:** The tool should remember the user's API configuration (Endpoint, Model) using `localStorage` so they don't have to re-enter it on every refresh.

---

## 5\. Technical Specifications

* **Architecture:** Single HTML file containing CSS and JavaScript.  
* **Dependencies:**  
  * **Parsing:** PapaParse (for CSV).  
  * **Visualization:** Chart.js or Plotly.js (via CDN).  
  * **Styling:** Tailwind CSS (via CDN) for a modern, responsive look.  
* **Security:**  
  * No data is sent to any server except the user-defined AI API endpoint.  
  * API keys are stored locally in the browser and never transmitted to the developer.

---

## 6\. Success Metrics

* **Load Time:** The tool should be fully interactive within \<2 seconds of opening the HTML file.  
* **Usability:** A first-time user should be able to upload a CSV and see a chart in under 30 seconds.  
* **Integration:** Successful generation of insights across at least three different OpenAI-compatible providers (e.g., OpenAI, Groq, Local Ollama).

