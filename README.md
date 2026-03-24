# VectraMind Knowledge Graph Platform

A full-stack knowledge graph search assistant for PDF and web URL content, combining:
- LLM-based knowledge graph extraction (Neo4j)
- Vector retrieval with Qdrant embeddings
- FastAPI backend (Python)
- Next.js frontend (React + ReactFlow)
- Authentication with Clerk JWT
- Storage with AWS S3 compatible API

---

## 1. Project summary

`c:\knowledge_graph` is a mono-repo with:
- `kg_backend/` — FastAPI backend handling upload, vectorization, KG extraction, and querying.
- `kg_frontend/` — Next.js app containing the UI for upload/query/history/graph.

### Key capabilities
- Upload PDF files
- Process web URLs
- Extract text using PyMuPDF + OCR fallback (Tesseract)
- Chunk text and build dense embeddings via `sentence-transformers/all-MiniLM-L6-v2`
- Store vectors in Qdrant per user/task collection
- Create and store knowledge graph (entities+relationships) in Neo4j via LangChain and custom prompts
- Query by natural language from the UI using dense retrieval + KG context
- Inspect and highlight graph nodes + explanations

---

## 2. Tech stack

### Backend
- Python 3.11+ (implied)
- FastAPI (HTTP API)
- Uvicorn (ASGI server runtime)
- LangChain ecosystem:
  - `langchain`, `langchain-groq`, `langchain-huggingface`, `langchain-qdrant`, `langchain-community`.
- Qdrant vector database (`qdrant-client`)
- Neo4j graph database (`neo4j` driver)
- PyMuPDF (`fitz`) for PDF
- OCR: `pytesseract`, `Pillow` (optional, image PDFs)
- AWS S3 storage via `boto3` (S3/R2/local abstraction)
- JWT and Clerk integration via `PyJWT` + `requests`
- Caching with Redis (not strongly used but available in requirements)

### Frontend
- Next.js 15 (App Router)
- React 19
- Tailwind CSS, PostCSS
- Clerk auth via `@clerk/nextjs`
- ReactFlow for graph display
- react-toastify for notifications
- axios for upload requests

### Infrastructure
- Environment based configuration in `kg_backend/config.py`
- Dockerfile+cloudbuild scripts for CI/CD (GCP) in `kg_backend/`

---

## 3. Architecture and flow

### 3.1 Authentication
- `kg_backend/auth.py` uses Clerk JWKS from `https://valid-termite-98.clerk.accounts.dev`.
- Every endpoint (upload, query, graph metadata) requires `Authorization: Bearer <token>`.

### 3.2 Upload + ingest path

1. User hits `POST /upload_pdfs` with files (sidebar "Upload")
2. Backend stores files in S3 path `pdf_uploads/{user_id}/{task_id}/...`
3. Async background task `process_pdf_documents` begins:
   - downloads files from S3,
   - extracts text page by page (OCR fallback for scanned images),
   - splits text with `RecursiveCharacterTextSplitter` (chunk_size=3500, overlap=200),
   - builds KG via `services.kg_service.process_documents_for_kg`,
   - creates Qdrant collection per `user/task` via `services.qdrant_service.create_vectorstore_for_task`.
4. Task status tracked in memory dict `task_status` and polled via `/task_status/{task_id}` using frontend hook.

### 3.3 URL-to-index path

1. User enters URLs in sidebar and calls `POST /initialize_vector_index`.
2. `services/url_service.process_url_documents` loads pages with `UnstructuredURLLoader`, chunk/split, create KG, store in Qdrant.

### 3.4 Query path

- `POST /ask_pdf` (the primary query API; expects `question` + `task_ids[]`)
- Qdrant search across selected collections uses high-level semantic search + prompt template.
- Also pulls KG context via `services.kg_service.query_kg_for_question` to enrich answers.
- Returns LLM response, source chunks, relevant node list.

### 3.5 Knowledge Graph retrieval
- `GET /knowledge_graph` returns graph for user + optional `task_id`.
- `GET /knowledge_graph/history` returns metadata + counts about KG snapshots.
- `GET /knowledge_graph/node/explain` returns LLM explanation for a node.

### 3.6 Vector history
- `GET /vector/history` returns Qdrant task collection list.
- `POST /vector/query/{task_id}?question=` uses `ask_pdf_endpoint` as quick query wrapper.

---

## 4. Backend module roles

- `main.py`: FastAPI routes, startup (LLM init), CORS, request logging.
- `config.py`: env settings and validators + defaults.
- `auth.py`: Clerk JWT verification and user identity extraction.
- `storage.py`: S3 storage abstraction & helper functions.
- `cache.py`: query caching interface (not fully instrumented). 
- `services/pdf_service.py`: document ingestion, PDF parsing, vector retrieval path.
- `services/url_service.py`: URL ingestion and KG + vector store creation.
- `services/qdrant_service.py`: Qdrant collection CRUD, search multi-task.
- `services/kg_service.py`: knowledge graph extraction, storage in Neo4j, queries, node explanations.

---

## 5. Frontend features

### Pages
- `/` root checks `useUser` and redirects signed-in users to `/graph`
- `/graph` main app layout with sidebar + graph canvas.

### Sidebar tabs
- Upload (PDF + URLs)
- Query (ask question, voice support, list sources + nodes)
- History (task/graph history, select graphs to display)

### Graph canvas
- `KnowledgeGraph` renders nodes/edges in `reactflow` with auto-layout (dagre)
- Node click triggers `/knowledge_graph/node/explain`
- Filtering by node type, refresh, selected graph overlays.

### Task polling
- `useTaskPolling` (custom hook) polls `GET /task_status/{task_id}` until complete.
- Indicator panel appears while processing.

---

## 6. Setup

### 6.1 Prerequisites
- Node 18+
- Python 3.11+
- Docker (optional) for Qdrant + Neo4j + local backend
- Neo4j running at `bolt://localhost:7687`
- Qdrant running at `http://localhost:6333`
- S3 bucket or local path exposed via S3 (or modify `storage.py` for local files)
- Tesseract installed for OCR (optional but recommended for scanned PDFs)

### 6.2 Backend

```powershell
cd c:\knowledge_graph\kg_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
set GROQ_API_KEY=<your_groq_key>
set QDRANT_URL=http://localhost:6333
set NEO4J_URI=bolt://localhost:7687
set NEO4J_USER=neo4j
set NEO4J_PASSWORD=<your_password>
set AWS_S3_BUCKET_NAME=<bucket>  # if using S3
set AWS_ACCESS_KEY_ID=<key>
set AWS_SECRET_ACCESS_KEY=<secret>
set CLERK_SECRET_KEY=unused
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6.3 Frontend

```powershell
cd c:\knowledge_graph\kg_frontend
npm install
set NEXT_PUBLIC_API_URL=http://localhost:8000
set NEXT_PUBLIC_CLERK_FRONTEND_API=<clerk_frontend_api>
set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk_publishable_key>
npm run dev
```

### 6.4 Docker / GCP
- See `kg_backend/Dockerfile`, `kg_backend/cloudbuild.yaml`, `kg_backend/DEPLOYMENT_GCP.md`, `kg_backend/QUICK_DEPLOY_GCP.md` for cloud deployment details.

---

## 7. Workflow (end-to-end)

1. User authenticates via Clerk in Next.js.
2. User uploads PDF(s) or enters URLs.
3. Sidebar calls backend endpoints: `/upload_pdfs` / `/initialize_vector_index`.
4. Backend spawns background tasks: OCR+text extraction, embedding + Qdrant index, KG extraction + Neo4j persist.
5. Frontend polls status, updates graph list.
6. User selects graph(s) in history tab.
7. Graph view calls `/knowledge_graph` and renders local force-layout.
8. User asks questions (via text or voice) - request goes to `/ask_pdf`.
9. Backend queries Qdrant + KG and uses LLM to answer.
10. UI displays answer, sources, relevant nodes, and allows node explanation calls.

---

## 8. API endpoints reference

- `GET /` health check
- `GET /task_status/{task_id}`
- `POST /upload_pdfs` (multipart PDF upload)
- `POST /initialize_vector_index` (URL ingestion)
- `POST /ask_pdf` (question + task_ids)
- `GET /knowledge_graph` (user graph data)
- `GET /knowledge_graph/tasks` (task list)
- `GET /knowledge_graph/history` (history metadata)
- `GET /knowledge_graph/node/explain` (node explanation)
- `GET /vector/history` (Qdrant history)
- `POST /vector/query/{task_id}` (quick query fallback)

---

## 9. Notes and troubleshooting

- If queries return 403/401: check Clerk token setup and backend `auth` endpoint.
- If no results from /ask_pdf: verify Qdrant collections appear in `GET /vector/history` and documents in Qdrant.
- If KG is empty: ensure Neo4j is reachable and credentials are correct.
- If OCR fails: install Tesseract and confirm commands available in PATH.
- If LLM fails at startup: ensure `GROQ_API_KEY` is present and valid.

---

## 10. Next improvements

## Parallel KG Extraction (Kafka / Pub-Sub)

###  Problem in Current System
- KG extraction runs sequentially per chunk  
- LLM calls are slow and blocking  
- Not scalable for large PDFs or multiple concurrent users  

---

### Proposed Solution: Kafka-based Parallel Processing

#### Idea
Convert the KG extraction pipeline into a **distributed asynchronous system** using a pub-sub/message broker like Kafka.

---

### Architecture Flow

#### 1. Producer (FastAPI Backend)
- After chunking, push each chunk as a message to a Kafka topic `kg_chunks`

#### 2. Kafka Topic
Stores chunk messages in the format:

```json
{
  "task_id": "...",
  "user_id": "...",
  "chunk_text": "...",
  "chunk_id": "..."
}
```
### Consumers (Workers)
- Multiple worker services consume chunks in parallel  

**Each worker:**
- Calls LLM (LangChain + Groq)  
- Extracts entities and relationships  
- Writes results to Neo4j  

---

### Aggregation Layer
- Optionally track completion using Redis or a database  
- Mark task as complete when all chunks are processed  

---

### Tech Stack Additions
- Kafka / Redpanda (lighter alternative)  
- Celery (optional fallback)  
- Redis (task tracking)  
- Worker containers (horizontal scaling)  

---

### Benefits
- 5–10x faster ingestion via parallel LLM calls  
-  Horizontal scalability by adding more workers  
-  Fault tolerance with retry mechanisms  
- Decoupled architecture (clean system design)  

---

###  Bonus Enhancements
- Batch multiple chunks per worker to reduce LLM cost  
- Deduplicate entities before inserting into Neo4j  
- Add priority queues (process smaller documents first for better UX)  
