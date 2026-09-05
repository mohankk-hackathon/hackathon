#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  User reported: "the deployment to vercel failed, can you help redeploy".
  The Next.js Finance Tracker (Dashboard + Transactions + Analytics + Settings
  + AI Import + Duplicate Guard + Smart Insights + AI Coach streaming chat with
  memory) built cleanly locally, but Vercel's build/runtime was failing.

  Fix applied:
    1. /app/next.config.js
       - Removed `output: 'standalone'` (meant for self-hosted / Docker, not Vercel)
       - Added `pdf-parse` to `serverExternalPackages` so its module-load fs
         probe doesn't get bundled by webpack
    2. Added /app/vercel.json with framework=nextjs, buildCommand, installCommand,
       and functions maxDuration=60 for the catch-all API route
    3. Local `yarn build` succeeds cleanly (verified twice)

  Testing agent must verify all backend endpoints still work locally after this
  change so we're confident the fresh Vercel deploy will also pass.

backend:
  - task: "GET /api/root health check"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "After removing `output: standalone` from next.config.js and adding pdf-parse to serverExternalPackages. Please confirm GET /api/root still returns 200 with {message:'Finance Tracker API'}."

  - task: "POST /api/import - CSV auto-categorization"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Working previously (verified via curl and browser end-to-end). Re-verify after next.config.js changes: POST /api/import with a small CSV should return categorized transactions."

  - task: "POST /api/import - PDF auto-categorization"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "PDF parsing uses `import('pdf-parse/lib/pdf-parse.js')` lazy-loaded. pdf-parse is now marked as external in next.config.js. Testing agent should NOT block on PDF if no sample PDF is available — CSV is the primary check."

  - task: "POST /api/insights - Smart Insights"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Working previously. Re-verify: POST /api/insights with a few transactions returns array of insight objects with emoji/title/message/tone."

  - task: "POST /api/coach - streaming chat with memory"
    implemented: true
    working: "NA"
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Working previously. SSE endpoint that streams `data: {token: '...'}` chunks. Verify the response Content-Type is text/event-stream and that tokens arrive."

frontend:
  - task: "Vercel build passes locally"
    implemented: true
    working: true
    file: "next.config.js, vercel.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "yarn build passes locally after config change (verified twice). Vercel-specific hardening: removed output:standalone, added pdf-parse to external packages, added vercel.json."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/root health check"
    - "POST /api/import - CSV auto-categorization"
    - "POST /api/insights - Smart Insights"
    - "POST /api/coach - streaming chat with memory"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Vercel deployment failure fix applied. Please test the four backend endpoints
      at http://localhost:3000 (Next.js is running via supervisor):
        - GET  /api/root
        - POST /api/import      (send a small CSV via multipart form field "file")
        - POST /api/insights    (JSON body: {"transactions":[...]})
        - POST /api/coach       (JSON body: {"message":"...","transactions":[...],"history":[]}; SSE response)

      The EMERGENT_LLM_KEY and EMERGENT_BASE_URL are already set in /app/.env, so
      the AI endpoints should hit gpt-4o-mini through the Emergent proxy.

      Sample CSV content you can use for /api/import:
        Date,Description,Amount
        2026-09-01,STARBUCKS,-6.85
        2026-09-02,PAYROLL,2400.00
        2026-09-03,WALMART,-42.10

      Skip PDF testing if no sample PDF is available; CSV coverage is enough.

      For /api/coach please confirm the response Content-Type is
      "text/event-stream" and that at least a few `data: {...}` chunks arrive.
