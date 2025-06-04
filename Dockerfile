FROM ollama/ollama:latest

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Listen on all interfaces, port 11434
ENV OLLAMA_HOST 0.0.0.0:11434

# Store model weight files in /models
ENV OLLAMA_MODELS /models

# Reduce logging verbosity
ENV OLLAMA_DEBUG false

# Never unload model weights from the GPU
ENV OLLAMA_KEEP_ALIVE -1

# Store the model weights in the container image
# ENV MODEL gemma3:4b
# ENV MODEL deepseek-r1:14b
ENV MODEL qwen3:14b

RUN ollama serve & sleep 5 && ollama pull $MODEL

COPY package*.json ./
RUN npm install
COPY . ./

# Start both ollama and proxy inline, sourcing .env first
ENTRYPOINT ["/bin/bash", "-c", "ollama serve & exec npm start"]
