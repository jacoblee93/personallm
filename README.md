# 🦙 PersonalLM

This repo helps you provision a personal and private LLM inference endpoint on [Google Cloud Run GPUs](https://cloud.google.com/run). The endpoint is OpenAI and LangChain-compatible, allows for authentication via API key, and can be used as a drop-in substitute for providers who support these standards.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://myendpoint.europe-west1.run.app/v1",
    api_key="GENERATED_API_KEY",
)

response = client.chat.completions.create(
    model="qwen3:14b",
    messages=[
      {"role": "user", "content": "What is 2 + 2?"}
    ]
)
```

Once deployed, it requires no infrastructure management and scales down to zero instances when not in use. This makes it suitable for developing projects where privacy is an important consideration.

It contains a proxy server that runs in the Cloud Run instance that handles auth and forwards requests
to a concurrently running [Ollama](https://ollama.ai/) instance. This means that you can serve any model from
Ollama's registry in theory, though in practice caps on Cloud Run resources (for memory, currently 32 Gibibytes) limit
model size. See the [model customization](#-model-customization) section below for more details.

## 🏎️ Quickstart

### Setting up Google Cloud resources

> [!NOTE]
> The initial setup for this project is the same as the official Cloud Run guide [here](https://cloud.google.com/run/docs/tutorials/gpu-gemma-with-ollama).

If you don't already have a Google Cloud account, you will first need to [sign up](https://cloud.google.com/).

Navigate to the [Google Cloud project selector](https://console.cloud.google.com/projectselector2/home/dashboard) and select or create a Google Cloud project. You will need to [enabled billing for the project](https://cloud.google.com/billing/docs/how-to/verify-billing-enabled#confirm_billing_is_enabled_on_a_project), since GPUs are currently not part of Google Cloud's free tier.

Next, you must enable access to Artifact Registry, Cloud Build, Cloud Run, and Cloud Storage APIs for your project. [Click here](https://console.cloud.google.com/apis/enableflow?apiid=artifactregistry.googleapis.com,cloudbuild.googleapis.com,run.googleapis.com,storage.googleapis.com) and select your newly created project, then follow the instructions to do so.

![](/static/img/enable-apis.png)

GPUs are not part of the default project quota, so you will need to submit a quota increase request. From [this page](https://console.cloud.google.com/projectselector2/iam-admin/quotas), select your project, then filter by `Total Nvidia L4 GPU allocation without zonal redundancy, per project per region` in the search bar. Find your desired region (Google currently recommends `europe-west1`, note that [pricing](https://cloud.google.com/run/pricing) may vary depending on region), then click the side menu and press `Edit quota`:

![](/static/img/quotas.png)

Enter a value (e.g. `5`), and submit a request. Google claims that increase requests may take a few days to process, but you may receive an approval email almost immediately in practice.

Finally, you will need to set up proper IAM permissions for your project. Navigate to [this page](https://console.cloud.google.com/projectselector2/iam-admin/iam) and select your project, then press `Grant Access`. In the resulting modal, paste the following permissions into the filter window and add them one by one to the principal:

- `roles/artifactregistry.admin`
- `roles/cloudbuild.builds.editor`
- `roles/run.admin`
- `roles/resourcemanager.projectIamAdmin`
- `roles/iam.serviceAccountUser`
- `roles/serviceusage.serviceUsageConsumer`
- `roles/storage.admin`

![](/static/img/grant-access.png)

At the end, your screen should look something like this:

![](/static/img/access.png)

### Deploying your endpoint

Now, clone this repo if you haven't already and switch your working directory to be the cloned folder:

```bash
git clone https://github.com/jacoblee93/personallm.git
cd personallm
```

Rename the `.env.example` file to `.env`. Run something similar to the following command to randomly generate an API key:

```bash
openssl rand -base64 32
```

Paste this value into the `API_KEYS` field. You can provide multiple API keys by comma separating them here, so make sure that none of your key values contain commas.

Install and initialize the `gcloud` CLI if you haven't already by [following these instructions](https://cloud.google.com/sdk/docs/install). If you already have the CLI installed, you may need to run `gcloud components update` to make sure you are on the latest CLI version.

Next, set your `gcloud` CLI project to be your project name:

```bash
gcloud config set project YOUR_PROJECT_NAME
```

And set the region to be the same one as where you requested GPU quota:

```bash
gcloud config set run/region YOUR_REGION
```

Finally, run the following command to deploy your new inference endpoint!

```bash
gcloud run deploy personallm \
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

When prompted with something like `Allow unauthenticated invocations to [personallm] (y/N)?`, you should respond with `y`. The internal proxy will handle authentication, and we want our endpoint to be reachable from anywhere for ease of use.

Note that deployments are quite slow since model weights are bundled directly into the Dockerfile - expect this step to take around 20 minutes. Once it finishes, your terminal should print a `Service URL`, and that's it! You now have a personal, private LLM inference endpoint!

## 💪 Trying it out

You can call your endpoint in a similar way to how you'd call an OpenAI model, only using your generated API key and your provisioned endpoint. Here are some examples:

### OpenAI Python SDK

```bash
uv add openai
```

```python
from openai import OpenAI

# Note the /v1 suffix
client = OpenAI(
    base_url="https://YOUR_SERVICE_URL/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="qwen3:14b",
    messages=[
      {"role": "user", "content": "What is 2 + 2?"}
    ]
)
```

See [OpenAI's SDK docs](https://platform.openai.com/docs/overview) for examples of advanced features such as [function/tool calling](https://platform.openai.com/docs/guides/function-calling?api-mode=chat).

### LangChain

```bash
uv add langchain-ollama
```

```python
from langchain_ollama import ChatOllama

model = ChatOllama(
    model="qwen3:14b",
    base_url="https://YOUR_SERVICE_URL",
    client_kwargs={
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
)

response = model.invoke("What is 2 + 2?")
```

See [LangChain's docs](https://python.langchain.com/) for examples of advanced features such as [function/tool calling](https://python.langchain.com/docs/how_to/tool_calling/).

### OpenAI JS SDK

```bash
npm install openai
```

```js
import OpenAI from "openai";

// Note the /v1 suffix
const client = new OpenAI({
  baseURL: "https://YOUR_SERVICE_URL/v1",
  apiKey: "YOUR_API_KEY",
});

const result = await client.chat.completions.create({
  model: "qwen3:14b",
  messages: [{ role: "user", content: "What is 2 + 2?" }],
});
```

See [OpenAI's SDK docs](https://platform.openai.com/docs/overview) for examples of advanced features such as [function/tool calling](https://platform.openai.com/docs/guides/function-calling?api-mode=chat).

### LangChain.js

```bash
npm install @langchain/ollama @langchain/core
```

```js
const model = new ChatOllama({
  model: "qwen3:14b",
  baseUrl: "https://YOUR_SERVICE_URL",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
  },
});
const result = await model.invoke("What is 2 + 2?");
```

See [LangChain's docs](https://js.langchain.com/) for examples of advanced features such as [function/tool calling](https://js.langchain.com/docs/how_to/tool_calling/).

### Latency

Keep in mind that there will be additional cold start latency if the endpoint has not been used in some time.

## 🔧 Model customization

The base configuration in this repo serves a 14 billion parameter model ([Qwen 3](https://ollama.com/library/qwen3:14b)) clocked at ~20-25 output tokens per second. This model is quite capable and also supports [function/tool calling](https://ollama.com/blog/tool-support), which makes it more useful when building agentic flows, but if speed becomes a concern you might try smaller models such as Google's [Gemma 3](https://ollama.com/library/gemma3). You can also run [DeepSeek-R1](https://ollama.com/library/deepseek-r1:14b) if you do not need tool calling.

To customize the served model, open your `Dockerfile` and modify the `ENV MODEL qwen3:14b` line to be a different model from [Ollama's registry](https://ollama.com/search):

```ini
# Store the model weights in the container image
# ENV MODEL gemma3:4b
# ENV MODEL deepseek-r1:14b
ENV MODEL qwen3:14b
```

Note that you will also have to change your clientside code to specify the new model as a parameter.

## 🙏 Thank you!

If you have any questions or comments, please open an issue on this repo. You can also reach me [@Hacubu](https://x.com/Hacubu) on X (formerly Twitter).
