# Building Your AI Success Factory

## *A Guide for Citizen Developers*

## **Why Build a System?**

If you just chat with an AI, you are guessing. By building a "workspace" around your AI, you create a factory that produces reliable work. This saves you from constantly fixing the same mistakes and keeps your projects organized.

## **The 5 Essential Files**

Every project needs these five files to succeed. Think of them as your project's brain.

1. **PRD.md (The Blueprint):** This is where you define *what* you are building, *why* you are building it, and how to measure success. It is the starting point for every project.  
2. **.instructions.md (The Manager):** This is your project's rulebook. It tells the AI what to do and what not to do. Keep it under 100 lines. Use clear rules like "NEVER" or "YOU MUST."  
3. **DEVLOG.md (The Diary):** This is your project's history. Add an entry after every work session explaining what you did, why you made certain choices, and any errors you found. Never delete old entries.  
4. **CONTEXT.md (The Sticky Note):** This tracks your *current* task. It changes every session. It keeps the AI focused on the next specific step rather than getting lost.  
5. **.env (The Secret Vault):** This stores sensitive info like API keys. *Never* share this file or commit it to shared code.

## **The Workflow Loop**

Every time you work with your AI, follow this cycle:

1. **Start:** The AI reads your project files (rules, instructions, history, context).  
   Begin each session by telling AI “Read .instructions.md”  
2. **Do:** The AI works *only* on the specific task listed in CONTEXT.md. No side quests.  
3. **Close:** Update CONTEXT.md with the next step. Record your progress in [DEVLOG.md](http://DEVLOG.md).  
   Your AI agent should update these files automatically as those update requests should be part of .instructions.md

## **Concrete Tips for Success**

* **Keep it short:** Long instructions get ignored. If a file is over 100 lines, you're likely adding too much fluff.  
* **Be specific:** Don't just say "write good code." Say "Use snake\_case and include docstrings."  
* **Validate:** Before ending a session, check if your work actually meets your PRD goals and that the [DEVLOG.md](http://DEVLOG.md) and [CONTEXT.md](http://CONTEXT.md) have been updated.  
* **Clean house:** If CONTEXT.md is outdated, refresh it. Old info leads to bad results.  
* **Consistency:** Use these file names (PRD.md, DEVLOG.md, etc.) for every project so you always know where to look.

