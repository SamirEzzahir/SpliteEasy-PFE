FROM python:3.11-slim

# Set working directory
WORKDIR /app

# requirements.txt is now inside the backend folder
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source into backend/ subdirectory to preserve module import structure
COPY . ./backend/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
