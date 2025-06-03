```bash
openssl rand -base64 32
```

```bash
gcloud run deploy ollama-gemma \
  --source . \
  --concurrency 4 \
  --cpu 8 \
  --set-env-vars OLLAMA_NUM_PARALLEL=4 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --max-instances 1 \
  --memory 32Gi \
  --no-cpu-throttling \
  --no-gpu-zonal-redundancy \
  --timeout=600
```
