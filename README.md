**ReflectivAI App**

**About**

This project contains everything you need to run ReflectivAI locally.

**Local Development**

1. Install dependencies: `npm install`
2. Start the frontend: `npm run dev`
3. (Optional) Start the worker API: `npm run worker:dev`

The app will be available at <http://localhost:5173>.


**Proxy Environment Note**

If you see `npm warn Unknown env config "http-proxy"`, run npm commands with legacy proxy env vars unset (npm v10 deprecates that key format):

```bash
env -u npm_config_http_proxy -u npm_config_https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm run dev
```

Use the same `env -u ...` prefix for `npm run build` and `npm run lint`.
