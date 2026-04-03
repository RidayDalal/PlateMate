# PlateMate 🍽️

**PlateMate** is a full-stack "editorial kitchen" application that transforms pantry ingredients into structured recipes. By bridging the gap between generative AI and existing video content, PlateMate offers a unique **Synchronized Video Tutorial** experience where the written recipe is grounded in real-time video transcripts.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Runtime & Server** | Node.js (ES Modules), Express.js |
| **Database** | PostgreSQL (Relational mapping & Caching) |
| **AI & LLM** | OpenRouter (Gemini/Gemma 2.0) |
| **External APIs** | YouTube Data API v3, YouTube Transcript API |
| **Frontend** | HTML5, CSS3 (Custom Editorial Design), JavaScript (Vanilla) |

---

## 🏗️ System Architecture

PlateMate is designed as a linear data pipeline to ensure 100% alignment between visual media and textual instructions:

1. **User Input:** Captures ingredients, cuisine, and dietary constraints.
2. **Media Discovery:** Queries the YouTube Data API for high-quality, embeddable tutorials.
3. **Transcript Extraction:** Scrapes raw caption data to serve as the "Source of Truth."
4. **LLM Refinement:** The AI processes the messy transcript alongside user allergies to generate a polished, safe, and formatted recipe.
5. **Persistence:** The final "snapshot" is stored in PostgreSQL, allowing users to revisit the exact same recipe without re-generating or consuming API quotas.

---

## ✨ Key Features

### 🔄 Synced Video Tutorials
Unlike standard generators, PlateMate can ground its recipes in video data. The AI analyzes the specific video transcript to ensure the written steps and measurements perfectly match the visual guide on screen.

### ⚡ Independent Text Recipes
For users in a hurry, the app provides high-speed, text-only generation that utilizes the LLM’s internal culinary knowledge without the overhead of video processing.

### 🛡️ Allergy-Aware Logic
User profiles store persistent dietary triggers. The system automatically injects these into the AI context, forcing high-priority warnings and suggesting safe ingredient substitutions within the recipe steps.

### 📦 Smart Caching & Optimization
To manage API quotas effectively, PlateMate caches YouTube metadata and finalized AI responses. This reduces latency for common searches and ensures the app remains performant under the 10,000-unit YouTube limit.

---