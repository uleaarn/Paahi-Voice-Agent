
# Paahi/Jalwa AI Platform

## Backend Setup (Python)
1. Navigate to `/backend`
2. Install dependencies: `pip install fastapi uvicorn sqlalchemy passlib[bcrypt] python-jose[cryptography] psycopg2-binary`
3. Configure DB: Update `database.py` with your PostgreSQL URL.
4. Run: `uvicorn main:app --reload`

## Frontend Setup
1. Standard React installation: `npm install`
2. Run: `npm run dev`

## Security Notes
- Password Hashing: Bcrypt is used via `passlib`.
- JWT Tokens: Rotated and stored in secure contexts.
- RBAC: Scoped per `restaurant_id` on all sensitive routes.
